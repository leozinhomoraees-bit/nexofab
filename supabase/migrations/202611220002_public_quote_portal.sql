-- Portal público de orçamento por empresa (/p/<slug>) com resolução explícita de tenant,
-- rate limiting persistido em schema privado, validação no banco e zero service_role.

-- ============================================================================
-- 1. Colunas de slug público e opt-in explícito na tabela organizations
-- ============================================================================

alter table public.organizations
  add column if not exists public_slug text,
  add column if not exists public_portal_enabled boolean not null default false;

alter table public.organizations
  drop constraint if exists organizations_public_slug_format_chk;

alter table public.organizations
  add constraint organizations_public_slug_format_chk
  check (
    public_slug is null or (
      length(public_slug) between 3 and 60
      and public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      and public_slug <> all(array[
        'admin', 'api', 'app', 'arte', 'auth', 'billing', 'cadastro', 'convite',
        'dashboard', 'entrar', 'esqueci-senha', 'gestao', 'login', 'nexofab',
        'onboarding', 'orcamentos', 'p', 'portal', 'privacidade', 'proposta',
        'recibo', 'redefinir-senha', 'sair', 'status', 'suporte', 'termos',
        'webhook', 'www'
      ])
    )
  );

alter table public.organizations
  drop constraint if exists organizations_public_portal_requires_slug_chk;

alter table public.organizations
  add constraint organizations_public_portal_requires_slug_chk
  check (not public_portal_enabled or public_slug is not null);

create unique index if not exists organizations_public_slug_unique_idx
  on public.organizations (lower(public_slug))
  where public_slug is not null;

-- ============================================================================
-- 2. Tabela privada de rate limiting para envios públicos (sem grants ao cliente)
-- ============================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.public_lead_rate_limits (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ip_hash text not null check (length(ip_hash) = 64),
  created_at timestamptz not null default now()
);

create index if not exists public_lead_rate_limits_org_ip_idx
  on private.public_lead_rate_limits (organization_id, ip_hash, created_at desc);

create index if not exists public_lead_rate_limits_created_idx
  on private.public_lead_rate_limits (created_at);

revoke all on table private.public_lead_rate_limits from public, anon, authenticated;

-- ============================================================================
-- 3. RPC pública de leitura do portal (somente branding seguro + assinatura ativa)
-- ============================================================================

create or replace function public.get_public_quote_portal(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_org public.organizations;
begin
  if length(v_slug) < 3 or length(v_slug) > 60 or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    return null;
  end if;

  select *
    into v_org
  from public.organizations
  where lower(public_slug) = v_slug
    and public_portal_enabled = true
  limit 1;

  if v_org.id is null then
    return null;
  end if;

  if not public.has_active_subscription(v_org.id) then
    return null;
  end if;

  return jsonb_build_object(
    'public_slug', v_org.public_slug,
    'trade_name', v_org.trade_name,
    'logo_url', v_org.logo_url,
    'email', v_org.email,
    'phone', v_org.phone,
    'whatsapp', v_org.whatsapp,
    'website', v_org.website,
    'address_city', v_org.address_city,
    'address_state', v_org.address_state,
    'proposal_footer', v_org.proposal_footer
  );
end;
$$;

revoke all on function public.get_public_quote_portal(text) from public;
grant execute on function public.get_public_quote_portal(text) to anon, authenticated;

-- ============================================================================
-- 4. RPC pública de submissão de lead/orçamento com rate limiting e tenant explícito
-- ============================================================================

create or replace function public.submit_public_quote_lead(
  p_slug text,
  p_customer_name text,
  p_phone text,
  p_service text,
  p_company text default null,
  p_email text default null,
  p_dimensions text default null,
  p_material text default 'A definir',
  p_details text default null,
  p_quantity integer default 1,
  p_client_ip_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_customer_name text := trim(coalesce(p_customer_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_service text := trim(coalesce(p_service, ''));
  v_company text := nullif(trim(coalesce(p_company, '')), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_dimensions text := nullif(trim(coalesce(p_dimensions, '')), '');
  v_material text := coalesce(nullif(trim(coalesce(p_material, '')), ''), 'A definir');
  v_details text := nullif(trim(coalesce(p_details, '')), '');
  v_quantity integer := coalesce(p_quantity, 1);
  v_org public.organizations;
  v_ip_hash text;
  v_raw_headers text;
  v_fallback_ip text;
  v_ip_hits integer;
  v_org_hits integer;
  v_quote_id uuid;
  v_quote_number bigint;
  v_quote_created_at timestamptz;
  v_display_customer text;
begin
  if length(v_slug) < 3 or length(v_slug) > 60 or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Portal de orçamento indisponível';
  end if;

  select *
    into v_org
  from public.organizations
  where lower(public_slug) = v_slug
    and public_portal_enabled = true
  limit 1;

  if v_org.id is null or not public.has_active_subscription(v_org.id) then
    raise exception 'Portal de orçamento indisponível';
  end if;

  -- Validação defensiva no banco (impede abuso mesmo em chamadas diretas à RPC)
  if length(v_customer_name) < 2 or length(v_customer_name) > 120 then
    raise exception 'Informe seu nome completo (2 a 120 caracteres)';
  end if;
  if length(v_phone) < 8 or length(v_phone) > 40 or length(regexp_replace(v_phone, '\D', '', 'g')) < 8 then
    raise exception 'Informe um WhatsApp ou telefone válido';
  end if;
  if length(v_service) < 2 or length(v_service) > 120 then
    raise exception 'Informe o serviço ou projeto desejado';
  end if;
  if v_company is not null and length(v_company) > 120 then
    raise exception 'Nome da empresa excede o limite permitido';
  end if;
  if v_email is not null and (length(v_email) > 180 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'Informe um e-mail válido';
  end if;
  if v_dimensions is not null and length(v_dimensions) > 120 then
    raise exception 'Resumo das medidas excede o limite permitido';
  end if;
  if length(v_material) > 160 then
    raise exception 'Material excede o limite permitido';
  end if;
  if v_details is not null and length(v_details) > 1800 then
    raise exception 'Detalhes do projeto excedem o limite permitido';
  end if;
  if v_quantity < 1 or v_quantity > 1000000 then
    raise exception 'Quantidade inválida';
  end if;

  -- Normaliza ou deriva hash de origem para rate limiting persistente
  if p_client_ip_hash is not null and p_client_ip_hash ~ '^[a-f0-9]{64}$' then
    v_ip_hash := p_client_ip_hash;
  else
    v_raw_headers := nullif(current_setting('request.headers', true), '');
    begin
      v_fallback_ip := coalesce(
        nullif(trim(split_part(coalesce(v_raw_headers::jsonb ->> 'x-forwarded-for', ''), ',', 1)), ''),
        nullif(trim(coalesce(v_raw_headers::jsonb ->> 'x-real-ip', '')), ''),
        'direct-rpc'
      );
    exception when others then
      v_fallback_ip := 'direct-rpc';
    end;
    v_ip_hash := encode(digest(v_org.id::text || ':' || v_fallback_ip, 'sha256'), 'hex');
  end if;

  -- Limpeza leve de registros expirados e checagem de janela deslizante (1 hora)
  delete from private.public_lead_rate_limits
  where created_at < now() - interval '2 hours';

  select count(*)
    into v_ip_hits
  from private.public_lead_rate_limits
  where organization_id = v_org.id
    and ip_hash = v_ip_hash
    and created_at >= now() - interval '1 hour';

  if v_ip_hits >= 5 then
    raise exception 'Limite de solicitações atingido. Aguarde alguns minutos e tente novamente.';
  end if;

  select count(*)
    into v_org_hits
  from private.public_lead_rate_limits
  where organization_id = v_org.id
    and created_at >= now() - interval '1 hour';

  if v_org_hits >= 40 then
    raise exception 'Limite temporário de solicitações atingido para esta empresa. Tente novamente mais tarde.';
  end if;

  insert into private.public_lead_rate_limits (organization_id, ip_hash)
  values (v_org.id, v_ip_hash);

  -- Propaga tenant explicitamente para o trigger set_row_organization()
  perform set_config('nexofab.system_organization_id', v_org.id::text, true);

  insert into public.quotes (
    organization_id,
    customer_name,
    company,
    phone,
    email,
    service,
    dimensions,
    material,
    details,
    quantity,
    status,
    source,
    created_by
  ) values (
    v_org.id,
    v_customer_name,
    v_company,
    v_phone,
    v_email,
    v_service,
    v_dimensions,
    v_material,
    v_details,
    v_quantity,
    'novo',
    'site',
    null
  )
  returning id, number, created_at
    into v_quote_id, v_quote_number, v_quote_created_at;

  v_display_customer := coalesce(v_company, v_customer_name);

  insert into public.management_notifications (
    organization_id,
    type,
    title,
    message,
    quote_id,
    metadata
  ) values (
    v_org.id,
    'system',
    'Novo pedido pelo portal #' || v_quote_number,
    v_display_customer || ' solicitou orçamento de ' || v_service || '.',
    v_quote_id,
    jsonb_build_object(
      'quoteNumber', v_quote_number,
      'customer', v_display_customer,
      'phone', v_phone,
      'service', v_service,
      'source', 'public_portal'
    )
  );

  perform set_config('nexofab.system_organization_id', '', true);

  return jsonb_build_object(
    'quoteNumber', v_quote_number,
    'createdAt', v_quote_created_at,
    'tradeName', v_org.trade_name,
    'whatsapp', v_org.whatsapp
  );
end;
$$;

revoke all on function public.submit_public_quote_lead(
  text, text, text, text, text, text, text, text, text, integer, text
) from public;

grant execute on function public.submit_public_quote_lead(
  text, text, text, text, text, text, text, text, text, integer, text
) to anon, authenticated;

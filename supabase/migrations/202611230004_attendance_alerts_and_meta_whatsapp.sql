-- Central de Atendimentos (clientes sem resposta), Agenda de Retorno e
-- Integração Oficial Meta WhatsApp Cloud API com trava rígida de 24h (zero service_role).

-- ============================================================================
-- 1. Colunas de acompanhamento comercial em public.quotes
-- ============================================================================

alter table public.quotes
  add column if not exists last_contact_at timestamptz,
  add column if not exists next_contact_at timestamptz;

create index if not exists quotes_org_followup_idx
  on public.quotes (organization_id, status, next_contact_at);

-- ============================================================================
-- 2. Tabelas multiempresa de atendimentos e mensagens WhatsApp
-- ============================================================================

create table if not exists public.whatsapp_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  phone text not null,
  contact_name text not null,
  subject text,
  source text not null default 'manual' check (source in ('manual', 'whatsapp_meta', 'portal')),
  status text not null default 'waiting_reply' check (status in ('waiting_reply', 'replied', 'snoozed', 'closed')),
  unread_count integer not null default 1 check (unread_count >= 0),
  last_message_preview text,
  last_message_direction text not null default 'inbound' check (last_message_direction in ('inbound', 'outbound')),
  last_customer_message_at timestamptz not null default now(),
  last_reply_at timestamptz,
  next_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists whatsapp_threads_org_phone_unique_idx
  on public.whatsapp_threads (organization_id, phone);
create index if not exists whatsapp_threads_org_status_idx
  on public.whatsapp_threads (organization_id, status, last_customer_message_at desc);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  thread_id uuid not null references public.whatsapp_threads(id) on delete cascade,
  provider_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  sent_via text not null default 'manual' check (sent_via in ('meta_api', 'manual', 'whatsapp_web')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists whatsapp_messages_org_provider_unique_idx
  on public.whatsapp_messages (organization_id, provider_message_id)
  where provider_message_id is not null;
create index if not exists whatsapp_messages_thread_created_idx
  on public.whatsapp_messages (thread_id, created_at desc);

drop trigger if exists set_tenant_context on public.whatsapp_threads;
create trigger set_tenant_context
  before insert or update on public.whatsapp_threads
  for each row execute function public.set_row_organization();

drop trigger if exists whatsapp_threads_updated_at on public.whatsapp_threads;
create trigger whatsapp_threads_updated_at
  before update on public.whatsapp_threads
  for each row execute function public.set_updated_at();

drop trigger if exists set_tenant_context on public.whatsapp_messages;
create trigger set_tenant_context
  before insert or update on public.whatsapp_messages
  for each row execute function public.set_row_organization();

alter table public.whatsapp_threads enable row level security;
alter table public.whatsapp_threads force row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_messages force row level security;

revoke all on table public.whatsapp_threads, public.whatsapp_messages from public, anon, authenticated;
grant select, insert, update, delete on table public.whatsapp_threads to authenticated;
grant select, insert on table public.whatsapp_messages to authenticated;

-- Políticas RLS granulares por departamento
drop policy if exists "rbac_read_whatsapp_threads" on public.whatsapp_threads;
create policy "rbac_read_whatsapp_threads" on public.whatsapp_threads
for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_organization_role(organization_id, array['owner', 'admin', 'comercial', 'financeiro', 'producao'])
);

drop policy if exists "rbac_insert_whatsapp_threads" on public.whatsapp_threads;
create policy "rbac_insert_whatsapp_threads" on public.whatsapp_threads
for insert to authenticated
with check (
  organization_id = public.current_organization_id()
  and public.has_organization_role(organization_id, array['owner', 'admin', 'comercial', 'financeiro'])
);

drop policy if exists "rbac_update_whatsapp_threads" on public.whatsapp_threads;
create policy "rbac_update_whatsapp_threads" on public.whatsapp_threads
for update to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_organization_role(organization_id, array['owner', 'admin', 'comercial', 'financeiro'])
)
with check (
  organization_id = public.current_organization_id()
  and public.has_organization_role(organization_id, array['owner', 'admin', 'comercial', 'financeiro'])
);

drop policy if exists "rbac_delete_whatsapp_threads" on public.whatsapp_threads;
create policy "rbac_delete_whatsapp_threads" on public.whatsapp_threads
for delete to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_organization_role(organization_id, array['owner', 'admin'])
);

drop policy if exists "rbac_read_whatsapp_messages" on public.whatsapp_messages;
create policy "rbac_read_whatsapp_messages" on public.whatsapp_messages
for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_organization_role(organization_id, array['owner', 'admin', 'comercial', 'financeiro', 'producao'])
);

drop policy if exists "rbac_insert_whatsapp_messages" on public.whatsapp_messages;
create policy "rbac_insert_whatsapp_messages" on public.whatsapp_messages
for insert to authenticated
with check (
  organization_id = public.current_organization_id()
  and public.has_organization_role(organization_id, array['owner', 'admin', 'comercial', 'financeiro'])
);

-- ============================================================================
-- 3. Configuração privada da Meta WhatsApp Cloud API (sem grants ao cliente)
-- ============================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.whatsapp_integrations (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  mode text not null default 'monitor_only' check (mode in ('monitor_only', 'reply_24h_locked')),
  phone_number_id text,
  display_phone text,
  verify_token text not null,
  access_token text,
  app_secret text,
  alert_after_minutes integer not null default 30 check (alert_after_minutes between 5 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists whatsapp_integrations_phone_number_id_unique
  on private.whatsapp_integrations (phone_number_id)
  where phone_number_id is not null and phone_number_id <> '';

revoke all on table private.whatsapp_integrations from public, anon, authenticated;

-- Leitura segura da configuração (nunca retorna access_token nem app_secret ao frontend)
create or replace function public.get_organization_whatsapp_config()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_org_id uuid := public.current_organization_id();
  v_cfg private.whatsapp_integrations;
begin
  if v_org_id is null or not public.has_organization_role(v_org_id, array['owner', 'admin', 'comercial', 'financeiro']) then
    raise exception 'Acesso não autorizado';
  end if;

  select * into v_cfg
  from private.whatsapp_integrations
  where organization_id = v_org_id;

  if v_cfg.organization_id is null then
    return jsonb_build_object(
      'configured', false,
      'enabled', false,
      'mode', 'monitor_only',
      'phoneNumberId', '',
      'displayPhone', '',
      'alertAfterMinutes', 30,
      'verifyToken', null,
      'hasAccessToken', false,
      'hasAppSecret', false,
      'organizationId', v_org_id
    );
  end if;

  return jsonb_build_object(
    'configured', true,
    'enabled', v_cfg.enabled,
    'mode', v_cfg.mode,
    'phoneNumberId', coalesce(v_cfg.phone_number_id, ''),
    'displayPhone', coalesce(v_cfg.display_phone, ''),
    'alertAfterMinutes', v_cfg.alert_after_minutes,
    'verifyToken', case when public.has_organization_role(v_org_id, array['owner', 'admin']) then v_cfg.verify_token else null end,
    'hasAccessToken', (v_cfg.access_token is not null and length(trim(v_cfg.access_token)) > 0),
    'hasAppSecret', (v_cfg.app_secret is not null and length(trim(v_cfg.app_secret)) > 0),
    'organizationId', v_org_id
  );
end;
$$;

revoke all on function public.get_organization_whatsapp_config() from public, anon;
grant execute on function public.get_organization_whatsapp_config() to authenticated;

-- Gravação segura da configuração (somente owner/admin)
create or replace function public.save_organization_whatsapp_config(
  p_enabled boolean,
  p_mode text,
  p_phone_number_id text default null,
  p_display_phone text default null,
  p_alert_after_minutes integer default 30,
  p_access_token text default null,
  p_app_secret text default null,
  p_clear_access_token boolean default false,
  p_clear_app_secret boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_org_id uuid := public.current_organization_id();
  v_existing private.whatsapp_integrations;
  v_phone_id text := nullif(trim(coalesce(p_phone_number_id, '')), '');
  v_display text := nullif(trim(coalesce(p_display_phone, '')), '');
  v_token text := nullif(trim(coalesce(p_access_token, '')), '');
  v_secret text := nullif(trim(coalesce(p_app_secret, '')), '');
  v_verify_token text;
  v_minutes integer := greatest(5, least(coalesce(p_alert_after_minutes, 30), 1440));
begin
  if v_org_id is null or not public.has_organization_role(v_org_id, array['owner', 'admin']) then
    raise exception 'Apenas administradores podem configurar o WhatsApp oficial';
  end if;
  if p_mode not in ('monitor_only', 'reply_24h_locked') then
    raise exception 'Modo de integração inválido';
  end if;
  if p_enabled and v_phone_id is null then
    raise exception 'Informe o Phone Number ID da Meta para ativar o webhook';
  end if;

  select * into v_existing
  from private.whatsapp_integrations
  where organization_id = v_org_id;

  v_verify_token := coalesce(v_existing.verify_token, 'nxf_wa_' || encode(gen_random_bytes(18), 'hex'));

  insert into private.whatsapp_integrations (
    organization_id, enabled, mode, phone_number_id, display_phone,
    verify_token, access_token, app_secret, alert_after_minutes
  ) values (
    v_org_id, p_enabled, p_mode, v_phone_id, v_display,
    v_verify_token,
    case when p_clear_access_token then null else v_token end,
    case when p_clear_app_secret then null else v_secret end,
    v_minutes
  )
  on conflict (organization_id) do update set
    enabled = excluded.enabled,
    mode = excluded.mode,
    phone_number_id = excluded.phone_number_id,
    display_phone = excluded.display_phone,
    access_token = case
      when p_clear_access_token then null
      when v_token is not null then v_token
      else private.whatsapp_integrations.access_token
    end,
    app_secret = case
      when p_clear_app_secret then null
      when v_secret is not null then v_secret
      else private.whatsapp_integrations.app_secret
    end,
    alert_after_minutes = excluded.alert_after_minutes,
    updated_at = now();

  return public.get_organization_whatsapp_config();
end;
$$;

revoke all on function public.save_organization_whatsapp_config(boolean, text, text, text, integer, text, text, boolean, boolean) from public, anon;
grant execute on function public.save_organization_whatsapp_config(boolean, text, text, text, integer, text, text, boolean, boolean) to authenticated;

-- ============================================================================
-- 4. RPCs públicas do Webhook Meta WhatsApp Cloud API (zero service_role)
-- ============================================================================

create or replace function public.verify_meta_whatsapp_webhook(
  p_organization_id uuid,
  p_verify_token text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_expected text;
begin
  if p_organization_id is null or nullif(trim(coalesce(p_verify_token, '')), '') is null then
    return false;
  end if;

  select verify_token into v_expected
  from private.whatsapp_integrations
  where organization_id = p_organization_id;

  if v_expected is null then
    return false;
  end if;

  return encode(digest(v_expected, 'sha256'), 'hex') = encode(digest(trim(p_verify_token), 'sha256'), 'hex');
end;
$$;

revoke all on function public.verify_meta_whatsapp_webhook(uuid, text) from public;
grant execute on function public.verify_meta_whatsapp_webhook(uuid, text) to anon, authenticated;

-- Processa mensagens recebidas do webhook da Meta com verificação opcional de HMAC-SHA256
create or replace function public.process_meta_whatsapp_webhook(
  p_organization_id uuid,
  p_phone_number_id text,
  p_signature_256 text default null,
  p_raw_body text default '',
  p_events jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_cfg private.whatsapp_integrations;
  v_expected_sig text;
  v_event jsonb;
  v_phone text;
  v_contact_name text;
  v_body text;
  v_direction text;
  v_msg_id text;
  v_thread_id uuid;
  v_customer_id uuid;
  v_processed integer := 0;
begin
  if p_organization_id is null then
    raise exception 'Organização inválida';
  end if;

  select * into v_cfg
  from private.whatsapp_integrations
  where organization_id = p_organization_id
    and enabled = true;

  if v_cfg.organization_id is null then
    return jsonb_build_object('accepted', false, 'reason', 'disabled');
  end if;

  if v_cfg.phone_number_id is not null and nullif(trim(coalesce(p_phone_number_id, '')), '') is not null
     and v_cfg.phone_number_id <> trim(p_phone_number_id) then
    raise exception 'Phone Number ID não corresponde à organização';
  end if;

  if not public.has_active_subscription(p_organization_id) then
    return jsonb_build_object('accepted', false, 'reason', 'subscription_inactive');
  end if;

  -- Verifica assinatura HMAC-SHA256 da Meta quando app_secret estiver configurado
  if v_cfg.app_secret is not null and length(trim(v_cfg.app_secret)) > 0 then
    v_expected_sig := 'sha256=' || encode(hmac(convert_to(coalesce(p_raw_body, ''), 'utf8'), convert_to(v_cfg.app_secret, 'utf8'), 'sha256'), 'hex');
    if p_signature_256 is null or encode(digest(lower(trim(p_signature_256)), 'sha256'), 'hex') <> encode(digest(lower(v_expected_sig), 'sha256'), 'hex') then
      raise exception 'Assinatura do webhook Meta inválida';
    end if;
  end if;

  perform set_config('nexofab.system_organization_id', p_organization_id::text, true);

  for v_event in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb))
  loop
    v_phone := regexp_replace(coalesce(v_event ->> 'phone', ''), '\D', '', 'g');
    v_body := left(trim(coalesce(v_event ->> 'body', '')), 1800);
    v_direction := case when coalesce(v_event ->> 'direction', 'inbound') = 'outbound' then 'outbound' else 'inbound' end;
    v_msg_id := nullif(trim(coalesce(v_event ->> 'messageId', '')), '');
    v_contact_name := coalesce(nullif(left(trim(coalesce(v_event ->> 'contactName', '')), 120), ''), v_phone);

    if length(v_phone) < 8 or v_body = '' then
      continue;
    end if;

    -- Idempotência por provider_message_id
    if v_msg_id is not null and exists (
      select 1 from public.whatsapp_messages
      where organization_id = p_organization_id and provider_message_id = v_msg_id
    ) then
      continue;
    end if;

    select c.id into v_customer_id
    from public.customers c
    where c.organization_id = p_organization_id
      and (
        regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g') = v_phone
        or regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_phone
        or ('55' || regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g')) = v_phone
      )
    limit 1;

    if v_direction = 'inbound' then
      insert into public.whatsapp_threads (
        organization_id, customer_id, phone, contact_name, source, status,
        unread_count, last_message_preview, last_message_direction, last_customer_message_at, next_contact_at
      ) values (
        p_organization_id, v_customer_id, v_phone, v_contact_name, 'whatsapp_meta', 'waiting_reply',
        1, left(v_body, 220), 'inbound', now(), null
      )
      on conflict (organization_id, phone) do update set
        customer_id = coalesce(public.whatsapp_threads.customer_id, excluded.customer_id),
        contact_name = case
          when public.whatsapp_threads.contact_name = public.whatsapp_threads.phone then excluded.contact_name
          else public.whatsapp_threads.contact_name
        end,
        status = 'waiting_reply',
        unread_count = public.whatsapp_threads.unread_count + 1,
        last_message_preview = excluded.last_message_preview,
        last_message_direction = 'inbound',
        last_customer_message_at = now(),
        next_contact_at = null,
        updated_at = now()
      returning id into v_thread_id;
    else
      -- Mensagem enviada pelo próprio app WhatsApp Business (Coexistence echo): limpa pendência automaticamente!
      insert into public.whatsapp_threads (
        organization_id, customer_id, phone, contact_name, source, status,
        unread_count, last_message_preview, last_message_direction, last_customer_message_at, last_reply_at
      ) values (
        p_organization_id, v_customer_id, v_phone, v_contact_name, 'whatsapp_meta', 'replied',
        0, left(v_body, 220), 'outbound', now(), now()
      )
      on conflict (organization_id, phone) do update set
        status = case when public.whatsapp_threads.status = 'closed' then 'closed' else 'replied' end,
        unread_count = 0,
        last_message_preview = excluded.last_message_preview,
        last_message_direction = 'outbound',
        last_reply_at = now(),
        updated_at = now()
      returning id into v_thread_id;
    end if;

    insert into public.whatsapp_messages (
      organization_id, thread_id, provider_message_id, direction, body, sent_via
    ) values (
      p_organization_id, v_thread_id, v_msg_id, v_direction, v_body,
      case when v_direction = 'inbound' then 'meta_api' else 'whatsapp_web' end
    )
    on conflict do nothing;

    v_processed := v_processed + 1;
  end loop;

  perform set_config('nexofab.system_organization_id', '', true);

  return jsonb_build_object('accepted', true, 'processed', v_processed);
end;
$$;

revoke all on function public.process_meta_whatsapp_webhook(uuid, text, text, text, jsonb) from public;
grant execute on function public.process_meta_whatsapp_webhook(uuid, text, text, text, jsonb) to anon, authenticated;

-- ============================================================================
-- 5. Trava rígida de 24h no banco para resposta opcional via API Oficial Meta
-- ============================================================================

create or replace function public.prepare_meta_whatsapp_reply(p_thread_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_org_id uuid := public.current_organization_id();
  v_cfg private.whatsapp_integrations;
  v_thread public.whatsapp_threads;
  v_window_limit timestamptz;
begin
  if v_org_id is null or not public.has_organization_role(v_org_id, array['owner', 'admin', 'comercial', 'financeiro']) then
    raise exception 'Sem permissão para responder atendimentos';
  end if;
  if not public.has_active_subscription(v_org_id) then
    raise exception 'Assinatura inativa';
  end if;

  select * into v_cfg
  from private.whatsapp_integrations
  where organization_id = v_org_id;

  if v_cfg.organization_id is null or not v_cfg.enabled then
    raise exception 'Integração WhatsApp oficial não está ativada';
  end if;
  if v_cfg.mode <> 'reply_24h_locked' then
    raise exception 'O modo atual está como Somente Alerta (custo zero). Use "Abrir no WhatsApp" ou altere para Trava 24h nas configurações.';
  end if;
  if v_cfg.phone_number_id is null or v_cfg.access_token is null or length(trim(v_cfg.access_token)) = 0 then
    raise exception 'Configure o Phone Number ID e o Access Token da Meta para responder por aqui.';
  end if;

  select * into v_thread
  from public.whatsapp_threads
  where id = p_thread_id
    and organization_id = v_org_id;

  if v_thread.id is null then
    raise exception 'Atendimento não encontrado';
  end if;

  -- Trava rígida: exige última mensagem do cliente há menos de 23h50 (margem de 10 min antes das 24h da Meta)
  v_window_limit := v_thread.last_customer_message_at + interval '23 hours 50 minutes';
  if now() > v_window_limit then
    raise exception 'Trava de 24h acionada: a janela gratuita da Meta encerrou. Use "Abrir no WhatsApp" para evitar qualquer cobrança.';
  end if;

  return jsonb_build_object(
    'phoneNumberId', v_cfg.phone_number_id,
    'accessToken', v_cfg.access_token,
    'toPhone', v_thread.phone,
    'windowEndsAt', v_thread.last_customer_message_at + interval '24 hours'
  );
end;
$$;

revoke all on function public.prepare_meta_whatsapp_reply(uuid) from public, anon;
grant execute on function public.prepare_meta_whatsapp_reply(uuid) to authenticated;

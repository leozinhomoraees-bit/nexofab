-- Fase 6B: Planos aprovados do NexoFab (limite de 10 usuários), checkout Asaas e webhook idempotente sem service_role.

-- ============================================================================
-- 1. Planos oficiais aprovados (Plano Completo — 10 usuários ativos por empresa)
-- ============================================================================

insert into public.plans (
  id, name, description, billing_cycle, price_cents, monthly_price_cents,
  discount_percent, sort_order, entitlements, active
) values
  (
    'completo-mensal',
    'Plano Completo',
    'Acesso completo a orçamentos, precificação, plano de corte, produção, estoque, financeiro e até 10 usuários ativos.',
    'monthly',
    2900,
    2900,
    0,
    1,
    jsonb_build_object('max_users', 10),
    true
  ),
  (
    'completo-trimestral',
    'Plano Completo',
    'Acesso completo a todos os módulos e até 10 usuários ativos, com 14% de desconto no ciclo trimestral.',
    'quarterly',
    7500,
    2500,
    14,
    2,
    jsonb_build_object('max_users', 10),
    true
  ),
  (
    'completo-anual',
    'Plano Completo',
    'Acesso completo a todos os módulos e até 10 usuários ativos, com 31% de desconto no ciclo anual.',
    'yearly',
    24000,
    2000,
    31,
    3,
    jsonb_build_object('max_users', 10),
    true
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  billing_cycle = excluded.billing_cycle,
  price_cents = excluded.price_cents,
  monthly_price_cents = excluded.monthly_price_cents,
  discount_percent = excluded.discount_percent,
  sort_order = excluded.sort_order,
  entitlements = excluded.entitlements,
  active = excluded.active,
  updated_at = now();

-- ============================================================================
-- 2. Enforce do limite de usuários do plano (padrão 10) nos convites
-- ============================================================================

create or replace function public.organization_max_users(p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select nullif(p.entitlements ->> 'max_users', '')::integer
      from public.organization_subscriptions s
      join public.plans p on p.id = s.plan_id
      where s.organization_id = p_organization_id
      limit 1
    ),
    10
  );
$$;

revoke all on function public.organization_max_users(uuid) from public, anon;
grant execute on function public.organization_max_users(uuid) to authenticated;

create or replace function public.create_organization_invitation(p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  normalized_email text := lower(trim(p_email));
  raw_token text := encode(gen_random_bytes(32), 'hex');
  invitation public.organization_invitations;
  v_max_users integer;
  v_active_members integer;
  v_pending_invites integer;
begin
  if v_organization_id is null or not public.has_organization_role(v_organization_id, array['owner','admin']) then
    raise exception 'Apenas administradores podem convidar usuários';
  end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'E-mail inválido';
  end if;
  if p_role not in ('admin','comercial','producao','estoque','financeiro') then
    raise exception 'Papel inválido';
  end if;

  v_max_users := public.organization_max_users(v_organization_id);
  select count(*) into v_active_members
  from public.organization_members
  where organization_id = v_organization_id and status = 'active';

  select count(*) into v_pending_invites
  from public.organization_invitations
  where organization_id = v_organization_id
    and status = 'pending'
    and expires_at > now()
    and lower(email) <> normalized_email;

  if v_max_users is not null and (v_active_members + v_pending_invites) >= v_max_users then
    raise exception 'Limite de usuários do plano atingido (% usuários)', v_max_users;
  end if;

  update public.organization_invitations
  set status = 'revoked', updated_at = now()
  where organization_id = v_organization_id
    and lower(email) = normalized_email
    and status = 'pending';

  insert into public.organization_invitations(
    organization_id, email, role, token_hash, invited_by
  ) values (
    v_organization_id,
    normalized_email,
    p_role,
    encode(digest(raw_token, 'sha256'), 'hex'),
    auth.uid()
  ) returning * into invitation;

  return jsonb_build_object(
    'id', invitation.id,
    'token', raw_token,
    'email', invitation.email,
    'role', invitation.role,
    'expires_at', invitation.expires_at
  );
end;
$$;

create or replace function public.accept_organization_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  invitation public.organization_invitations;
  authenticated_email text;
  email_confirmed boolean;
  existing_member public.organization_members;
  v_max_users integer;
  v_active_members integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and active
  ) then
    raise exception 'Autenticação obrigatória';
  end if;
  if p_token is null or length(p_token) <> 64 then
    raise exception 'Convite inválido';
  end if;

  select lower(coalesce(u.email, '')), (u.email_confirmed_at is not null)
    into authenticated_email, email_confirmed
  from auth.users u
  where u.id = auth.uid();

  if not coalesce(email_confirmed, false) then
    raise exception 'Confirme seu e-mail antes de aceitar o convite';
  end if;

  select * into invitation
  from public.organization_invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and status = 'pending'
  for update;

  if invitation.id is null then raise exception 'Convite inválido ou já utilizado'; end if;
  if invitation.expires_at <= now() then
    raise exception 'Convite expirado';
  end if;
  if authenticated_email = '' or authenticated_email <> lower(invitation.email) then
    raise exception 'Entre com o mesmo e-mail que recebeu o convite';
  end if;

  select * into existing_member
  from public.organization_members
  where organization_id = invitation.organization_id and user_id = auth.uid();

  if existing_member.user_id is null or existing_member.status <> 'active' then
    v_max_users := public.organization_max_users(invitation.organization_id);
    select count(*) into v_active_members
    from public.organization_members
    where organization_id = invitation.organization_id and status = 'active';
    if v_max_users is not null and v_active_members >= v_max_users then
      raise exception 'Limite de usuários do plano atingido (% usuários)', v_max_users;
    end if;
  end if;

  insert into public.organization_members(organization_id, user_id, role, status, invited_by)
  values (invitation.organization_id, auth.uid(), invitation.role, 'active', invitation.invited_by)
  on conflict (organization_id, user_id) do update set
    role = case when existing_member.role = 'owner' then 'owner' else excluded.role end,
    status = 'active',
    invited_by = excluded.invited_by,
    updated_at = now();

  update public.organization_invitations
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = now(), updated_at = now()
  where id = invitation.id;

  update public.profiles
  set active_organization_id = invitation.organization_id, updated_at = now()
  where id = auth.uid();

  return invitation.organization_id;
end;
$$;

-- ============================================================================
-- 3. RPC autenticada para registrar checkout criado no Asaas (sem ativar plano)
-- ============================================================================

create or replace function public.save_organization_checkout(
  p_plan_id text,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_checkout_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.current_organization_id();
  v_plan public.plans;
  v_prev public.organization_subscriptions;
begin
  if v_org_id is null or not public.has_organization_role(v_org_id, array['owner', 'admin']) then
    raise exception 'Apenas administradores podem gerenciar a assinatura';
  end if;
  if nullif(trim(coalesce(p_provider_customer_id, '')), '') is null
     or nullif(trim(coalesce(p_provider_subscription_id, '')), '') is null then
    raise exception 'Dados do provedor de pagamento inválidos';
  end if;

  select * into v_plan
  from public.plans
  where id = p_plan_id and active = true;
  if v_plan.id is null then
    raise exception 'Plano não encontrado ou indisponível';
  end if;

  select * into v_prev
  from public.organization_subscriptions
  where organization_id = v_org_id
  for update;

  insert into public.organization_subscriptions (
    organization_id, plan_id, billing_cycle, status, provider,
    provider_customer_id, provider_subscription_id, provider_checkout_url, trial_ends_at
  ) values (
    v_org_id, v_plan.id, v_plan.billing_cycle, 'trialing', 'asaas',
    trim(p_provider_customer_id), trim(p_provider_subscription_id), nullif(trim(coalesce(p_checkout_url, '')), ''),
    now() + interval '7 days'
  )
  on conflict (organization_id) do update set
    plan_id = excluded.plan_id,
    billing_cycle = excluded.billing_cycle,
    provider = 'asaas',
    provider_customer_id = excluded.provider_customer_id,
    provider_subscription_id = excluded.provider_subscription_id,
    provider_checkout_url = coalesce(excluded.provider_checkout_url, public.organization_subscriptions.provider_checkout_url),
    cancel_at_period_end = false,
    updated_at = now();

  insert into public.subscription_audit_logs (
    organization_id, actor_user_id, event_type, previous_status, next_status, details
  ) values (
    v_org_id,
    auth.uid(),
    'checkout_created',
    v_prev.status,
    coalesce(v_prev.status, 'trialing'),
    jsonb_build_object(
      'provider', 'asaas',
      'plan_id', v_plan.id,
      'billing_cycle', v_plan.billing_cycle,
      'price_cents', v_plan.price_cents,
      'provider_subscription_id', trim(p_provider_subscription_id)
    )
  );

  return jsonb_build_object(
    'organization_id', v_org_id,
    'plan_id', v_plan.id,
    'billing_cycle', v_plan.billing_cycle,
    'provider_subscription_id', trim(p_provider_subscription_id)
  );
end;
$$;

revoke all on function public.save_organization_checkout(text, text, text, text) from public, anon;
grant execute on function public.save_organization_checkout(text, text, text, text) to authenticated;

-- ============================================================================
-- 4. Schema privado para hash do token de webhook e RPC idempotente do Asaas
-- ============================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.webhook_secrets (
  provider text primary key,
  token_hash text not null check (length(token_hash) = 64),
  updated_at timestamptz not null default now()
);

revoke all on table private.webhook_secrets from public, anon, authenticated;

create or replace function public.process_asaas_webhook_event(
  p_webhook_token text,
  p_provider_event_id text,
  p_event_type text,
  p_provider_subscription_id text default null,
  p_provider_customer_id text default null,
  p_external_reference text default null,
  p_payment_due_date date default null,
  p_invoice_url text default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_expected_hash text;
  v_provided_hash text;
  v_sub public.organization_subscriptions;
  v_org_id uuid;
  v_event_row_id uuid;
  v_next_status text;
  v_period_end timestamptz;
  v_grace_until timestamptz;
  v_cycle_interval interval;
  v_ref_uuid uuid;
begin
  select token_hash into v_expected_hash
  from private.webhook_secrets
  where provider = 'asaas';

  if v_expected_hash is null or nullif(trim(coalesce(p_webhook_token, '')), '') is null then
    raise exception 'Webhook não autorizado';
  end if;

  v_provided_hash := encode(digest(p_webhook_token, 'sha256'), 'hex');
  if v_provided_hash <> v_expected_hash then
    raise exception 'Webhook não autorizado';
  end if;

  if nullif(trim(coalesce(p_provider_event_id, '')), '') is null
     or nullif(trim(coalesce(p_event_type, '')), '') is null then
    raise exception 'Evento de webhook inválido';
  end if;

  -- Resolve a organização exclusivamente pela assinatura vinculada no servidor (com fallback validado).
  if nullif(trim(coalesce(p_provider_subscription_id, '')), '') is not null then
    select * into v_sub
    from public.organization_subscriptions
    where provider = 'asaas'
      and provider_subscription_id = trim(p_provider_subscription_id)
    for update;
  end if;

  if v_sub.organization_id is null and nullif(trim(coalesce(p_external_reference, '')), '') is not null then
    begin
      v_ref_uuid := trim(p_external_reference)::uuid;
    exception when invalid_text_representation then
      v_ref_uuid := null;
    end;
    if v_ref_uuid is not null then
      select * into v_sub
      from public.organization_subscriptions
      where organization_id = v_ref_uuid
        and (
          provider_customer_id is null
          or nullif(trim(coalesce(p_provider_customer_id, '')), '') is null
          or provider_customer_id = trim(p_provider_customer_id)
        )
      for update;
    end if;
  end if;

  v_org_id := v_sub.organization_id;

  -- Idempotência garantida por unique (provider, provider_event_id).
  insert into public.billing_events (
    provider, provider_event_id, organization_id, event_type, payload
  ) values (
    'asaas',
    trim(p_provider_event_id),
    v_org_id,
    trim(p_event_type),
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event_row_id;

  if v_event_row_id is null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if v_org_id is null then
    update public.billing_events set processed_at = now() where id = v_event_row_id;
    return jsonb_build_object('ok', true, 'ignored', true, 'reason', 'organization_not_matched');
  end if;

  v_cycle_interval := case coalesce(v_sub.billing_cycle, 'monthly')
    when 'yearly' then interval '1 year'
    when 'quarterly' then interval '3 months'
    else interval '1 month'
  end;

  v_next_status := v_sub.status;
  v_period_end := v_sub.current_period_ends_at;
  v_grace_until := v_sub.grace_until;

  if p_event_type in ('PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED') then
    v_next_status := 'active';
    v_period_end := greatest(now(), coalesce(p_payment_due_date::timestamptz, now())) + v_cycle_interval + interval '2 days';
    v_grace_until := null;
  elsif p_event_type = 'PAYMENT_OVERDUE' then
    v_next_status := 'past_due';
    v_grace_until := now() + interval '3 days';
  elsif p_event_type in ('SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED', 'PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED') then
    v_next_status := 'canceled';
    v_grace_until := null;
  end if;

  update public.organization_subscriptions
  set status = v_next_status,
      provider = 'asaas',
      provider_customer_id = coalesce(nullif(trim(coalesce(p_provider_customer_id, '')), ''), provider_customer_id),
      provider_subscription_id = coalesce(nullif(trim(coalesce(p_provider_subscription_id, '')), ''), provider_subscription_id),
      provider_checkout_url = coalesce(nullif(trim(coalesce(p_invoice_url, '')), ''), provider_checkout_url),
      current_period_ends_at = v_period_end,
      grace_until = v_grace_until,
      updated_at = now()
  where organization_id = v_org_id;

  insert into public.subscription_audit_logs (
    organization_id, event_type, previous_status, next_status, details
  ) values (
    v_org_id,
    case
      when p_event_type in ('PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED') then 'subscription_activated'
      when p_event_type = 'PAYMENT_OVERDUE' then 'payment_overdue'
      when p_event_type in ('SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED', 'PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED') then 'subscription_canceled'
      else 'webhook_' || lower(p_event_type)
    end,
    v_sub.status,
    v_next_status,
    jsonb_build_object(
      'provider', 'asaas',
      'provider_event_id', trim(p_provider_event_id),
      'asaas_event', p_event_type,
      'period_ends_at', v_period_end
    )
  );

  update public.billing_events set processed_at = now() where id = v_event_row_id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'organization_id', v_org_id,
    'status', v_next_status
  );
end;
$$;

revoke all on function public.process_asaas_webhook_event(text, text, text, text, text, text, date, text, jsonb) from public;
grant execute on function public.process_asaas_webhook_event(text, text, text, text, text, text, date, text, jsonb) to anon, authenticated;

-- Fase 6A: Fundação de planos (mensal, trimestral e anual), trial automático de 7 dias e auditoria de assinatura.
-- Nenhum preço comercial é pré-cadastrado nesta migration; os planos são inseridos somente após aprovação comercial.

alter table public.plans
  add column if not exists billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'quarterly', 'yearly')),
  add column if not exists price_cents integer not null default 0
    check (price_cents >= 0),
  add column if not exists discount_percent integer not null default 0
    check (discount_percent between 0 and 90),
  add column if not exists sort_order integer not null default 0,
  add column if not exists asaas_cycle text generated always as (
    case billing_cycle
      when 'monthly' then 'MONTHLY'
      when 'quarterly' then 'QUARTERLY'
      else 'YEARLY'
    end
  ) stored;

create index if not exists plans_active_sort_idx
  on public.plans(active, sort_order, billing_cycle);

alter table public.organization_subscriptions
  add column if not exists billing_cycle text
    check (billing_cycle is null or billing_cycle in ('monthly', 'quarterly', 'yearly')),
  add column if not exists provider_checkout_url text,
  add column if not exists grace_until timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;

drop trigger if exists plans_updated_at on public.plans;
create trigger plans_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

drop trigger if exists organization_subscriptions_updated_at on public.organization_subscriptions;
create trigger organization_subscriptions_updated_at
  before update on public.organization_subscriptions
  for each row execute function public.set_updated_at();

create table if not exists public.subscription_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  previous_status text,
  next_status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscription_audit_logs_org_created_idx
  on public.subscription_audit_logs(organization_id, created_at desc);

alter table public.subscription_audit_logs enable row level security;
alter table public.subscription_audit_logs force row level security;

drop policy if exists "admins_read_subscription_audit_logs" on public.subscription_audit_logs;
create policy "admins_read_subscription_audit_logs" on public.subscription_audit_logs
for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_organization_role(organization_id, array['owner', 'admin'])
);

revoke all on table public.subscription_audit_logs from public, anon, authenticated;
grant select on table public.subscription_audit_logs to authenticated;

-- Helper de verificação de assinatura ativa ou em período de teste (7 dias) / carência graciosa.
create or replace function public.has_active_subscription(p_organization_id uuid default public.current_organization_id())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_subscriptions sub
    where sub.organization_id = p_organization_id
      and (
        (sub.status = 'active' and (sub.current_period_ends_at is null or sub.current_period_ends_at > now()))
        or (sub.status = 'trialing' and sub.trial_ends_at is not null and sub.trial_ends_at > now())
        or (sub.status = 'past_due' and sub.grace_until is not null and sub.grace_until > now())
      )
  );
$$;

revoke all on function public.has_active_subscription(uuid) from public, anon;
grant execute on function public.has_active_subscription(uuid) to authenticated;

-- Atualiza create_organization para iniciar automaticamente o trial de 7 dias com auditoria.
create or replace function public.create_organization(p_trade_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid;
  v_trial_ends_at timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and active
  ) then
    raise exception 'Autenticação obrigatória';
  end if;
  if length(trim(coalesce(p_trade_name, ''))) < 2 or length(trim(p_trade_name)) > 120 then
    raise exception 'Nome da empresa inválido';
  end if;

  insert into public.organizations(trade_name)
  values (trim(p_trade_name))
  returning id into v_organization_id;

  insert into public.organization_members(organization_id, user_id, role, status)
  values (v_organization_id, auth.uid(), 'owner', 'active');

  insert into public.organization_subscriptions(
    organization_id, status, provider, trial_ends_at
  ) values (
    v_organization_id, 'trialing', 'asaas', v_trial_ends_at
  ) on conflict (organization_id) do nothing;

  insert into public.subscription_audit_logs(
    organization_id, actor_user_id, event_type, previous_status, next_status, details
  ) values (
    v_organization_id,
    auth.uid(),
    'trial_started',
    null,
    'trialing',
    jsonb_build_object('trial_days', 7, 'trial_ends_at', v_trial_ends_at, 'provider', 'asaas')
  );

  update public.profiles
  set active_organization_id = v_organization_id, updated_at = now()
  where id = auth.uid();

  return v_organization_id;
end;
$$;

revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;

-- Backfill seguro: garante trial de 7 dias para organizações criadas antes desta migration.
insert into public.organization_subscriptions (organization_id, status, provider, trial_ends_at)
select o.id, 'trialing', 'asaas', coalesce(o.created_at, now()) + interval '7 days'
from public.organizations o
where not exists (
  select 1 from public.organization_subscriptions s where s.organization_id = o.id
);

insert into public.subscription_audit_logs (organization_id, event_type, previous_status, next_status, details)
select
  s.organization_id,
  'trial_initialized_backfill',
  null,
  s.status,
  jsonb_build_object('trial_days', 7, 'trial_ends_at', s.trial_ends_at, 'provider', coalesce(s.provider, 'asaas'))
from public.organization_subscriptions s
where not exists (
  select 1 from public.subscription_audit_logs l where l.organization_id = s.organization_id
);

-- Painel interno do fundador (/admin) sem service_role:
-- 1. Lista privada de administradores da plataforma (private.platform_admins).
-- 2. RPC is_platform_admin() exigindo usuário autenticado, ativo e e-mail confirmado.
-- 3. RPC get_founder_dashboard() expondo somente telemetria SaaS (sem dados operacionais de clientes).
-- 4. RPC founder_extend_trial() auditada para estender período de teste de clientes-piloto.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

revoke all on table private.platform_admins from public, anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from private.platform_admins pa
      join public.profiles p on p.id = pa.user_id and p.active = true
      join auth.users u on u.id = pa.user_id and u.email_confirmed_at is not null
      where pa.user_id = auth.uid()
    );
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.get_founder_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_kpis jsonb;
  v_organizations jsonb;
  v_webhooks jsonb;
  v_audit_logs jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao fundador';
  end if;

  with sub_state as (
    select
      o.id as organization_id,
      o.created_at as org_created_at,
      o.public_portal_enabled,
      s.status,
      s.trial_ends_at,
      s.current_period_ends_at,
      s.grace_until,
      coalesce(p.monthly_price_cents, 0) as monthly_price_cents,
      (s.status = 'active' and (s.current_period_ends_at is null or s.current_period_ends_at > v_now)) as is_active_paid,
      (s.status = 'trialing' and s.trial_ends_at is not null and s.trial_ends_at > v_now) as is_active_trial,
      (s.status = 'trialing' and s.trial_ends_at is not null and s.trial_ends_at > v_now and s.trial_ends_at <= v_now + interval '48 hours') as is_trial_expiring_48h,
      (s.status = 'past_due') as is_past_due
    from public.organizations o
    left join public.organization_subscriptions s on s.organization_id = o.id
    left join public.plans p on p.id = s.plan_id
  )
  select jsonb_build_object(
    'totalOrganizations', count(*)::integer,
    'activeSubscriptions', count(*) filter (where is_active_paid)::integer,
    'trialingSubscriptions', count(*) filter (where is_active_trial)::integer,
    'expiringTrials48h', count(*) filter (where is_trial_expiring_48h)::integer,
    'pastDueSubscriptions', count(*) filter (where is_past_due)::integer,
    'expiredOrCanceled', count(*) filter (where not is_active_paid and not is_active_trial and not is_past_due)::integer,
    'mrrCents', coalesce(sum(monthly_price_cents) filter (where is_active_paid), 0)::bigint,
    'arrCents', (coalesce(sum(monthly_price_cents) filter (where is_active_paid), 0) * 12)::bigint,
    'activePortals', count(*) filter (where public_portal_enabled = true)::integer,
    'newOrgs7d', count(*) filter (where org_created_at >= v_now - interval '7 days')::integer,
    'newOrgs30d', count(*) filter (where org_created_at >= v_now - interval '30 days')::integer,
    'confirmedUsers', (select count(*)::integer from auth.users where email_confirmed_at is not null)
  )
  into v_kpis
  from sub_state;

  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
  into v_organizations
  from (
    select
      o.created_at,
      jsonb_build_object(
        'id', o.id,
        'tradeName', o.trade_name,
        'publicSlug', o.public_slug,
        'publicPortalEnabled', o.public_portal_enabled,
        'createdAt', o.created_at,
        'ownerName', owner_info.full_name,
        'ownerEmail', owner_info.email,
        'activeMembers', coalesce(member_stats.active_members, 0),
        'quotesCount', coalesce(quote_stats.quotes_count, 0),
        'customersCount', coalesce(customer_stats.customers_count, 0),
        'ordersCount', coalesce(order_stats.orders_count, 0),
        'subscription', jsonb_build_object(
          'status', coalesce(s.status, 'expired'),
          'planId', s.plan_id,
          'planName', p.name,
          'billingCycle', coalesce(s.billing_cycle, p.billing_cycle),
          'monthlyPriceCents', coalesce(p.monthly_price_cents, 0),
          'trialEndsAt', s.trial_ends_at,
          'currentPeriodEndsAt', s.current_period_ends_at,
          'cancelAtPeriodEnd', coalesce(s.cancel_at_period_end, false),
          'provider', s.provider,
          'hasActiveAccess', public.has_active_subscription(o.id)
        )
      ) as row_data
    from public.organizations o
    left join public.organization_subscriptions s on s.organization_id = o.id
    left join public.plans p on p.id = s.plan_id
    left join lateral (
      select pr.full_name, u.email
      from public.organization_members om
      join auth.users u on u.id = om.user_id
      left join public.profiles pr on pr.id = om.user_id
      where om.organization_id = o.id and om.role = 'owner'
      order by om.created_at asc
      limit 1
    ) owner_info on true
    left join lateral (
      select count(*)::integer as active_members
      from public.organization_members om
      where om.organization_id = o.id and om.status = 'active'
    ) member_stats on true
    left join lateral (
      select count(*)::integer as quotes_count
      from public.quotes q
      where q.organization_id = o.id
    ) quote_stats on true
    left join lateral (
      select count(*)::integer as customers_count
      from public.customers c
      where c.organization_id = o.id and c.active = true
    ) customer_stats on true
    left join lateral (
      select count(*)::integer as orders_count
      from public.production_orders po
      where po.organization_id = o.id
    ) order_stats on true
    order by o.created_at desc
    limit 100
  ) sub;

  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
  into v_webhooks
  from (
    select
      be.created_at,
      jsonb_build_object(
        'id', be.id,
        'provider', be.provider,
        'providerEventId', be.provider_event_id,
        'eventType', be.event_type,
        'organizationId', be.organization_id,
        'organizationName', o.trade_name,
        'processedAt', be.processed_at,
        'createdAt', be.created_at
      ) as row_data
    from public.billing_events be
    left join public.organizations o on o.id = be.organization_id
    order by be.created_at desc
    limit 25
  ) sub;

  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
  into v_audit_logs
  from (
    select
      al.created_at,
      jsonb_build_object(
        'id', al.id,
        'organizationId', al.organization_id,
        'organizationName', o.trade_name,
        'eventType', al.event_type,
        'previousStatus', al.previous_status,
        'nextStatus', al.next_status,
        'createdAt', al.created_at
      ) as row_data
    from public.subscription_audit_logs al
    left join public.organizations o on o.id = al.organization_id
    order by al.created_at desc
    limit 25
  ) sub;

  return jsonb_build_object(
    'generatedAt', v_now,
    'kpis', v_kpis,
    'organizations', v_organizations,
    'recentWebhooks', v_webhooks,
    'recentAuditLogs', v_audit_logs
  );
end;
$$;

revoke all on function public.get_founder_dashboard() from public, anon;
grant execute on function public.get_founder_dashboard() to authenticated;

create or replace function public.founder_extend_trial(
  p_organization_id uuid,
  p_extra_days integer,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_sub public.organization_subscriptions;
  v_new_trial_end timestamptz;
  v_next_status text;
  v_clean_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao fundador';
  end if;
  if p_organization_id is null or not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organização não encontrada';
  end if;
  if p_extra_days is null or p_extra_days < 1 or p_extra_days > 90 then
    raise exception 'Informe entre 1 e 90 dias adicionais';
  end if;

  select * into v_sub
  from public.organization_subscriptions
  where organization_id = p_organization_id
  for update;

  v_new_trial_end := greatest(coalesce(v_sub.trial_ends_at, now()), now()) + make_interval(days => p_extra_days);
  v_next_status := case
    when v_sub.status = 'active' and (v_sub.current_period_ends_at is null or v_sub.current_period_ends_at > now())
      then 'active'
    else 'trialing'
  end;

  insert into public.organization_subscriptions (
    organization_id, status, provider, trial_ends_at
  ) values (
    p_organization_id, 'trialing', 'asaas', v_new_trial_end
  )
  on conflict (organization_id) do update set
    status = v_next_status,
    trial_ends_at = v_new_trial_end,
    cancel_at_period_end = false,
    updated_at = now();

  insert into public.subscription_audit_logs (
    organization_id, actor_user_id, event_type, previous_status, next_status, details
  ) values (
    p_organization_id,
    auth.uid(),
    'founder_trial_extended',
    v_sub.status,
    v_next_status,
    jsonb_build_object(
      'extra_days', p_extra_days,
      'new_trial_ends_at', v_new_trial_end,
      'reason', v_clean_reason
    )
  );

  return jsonb_build_object(
    'organizationId', p_organization_id,
    'status', v_next_status,
    'trialEndsAt', v_new_trial_end
  );
end;
$$;

revoke all on function public.founder_extend_trial(uuid, integer, text) from public, anon;
grant execute on function public.founder_extend_trial(uuid, integer, text) to authenticated;

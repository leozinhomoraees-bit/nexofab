-- Autoatendimento de cancelamento de renovação preservando acesso até o fim do período já pago.

create or replace function public.mark_organization_subscription_canceled(
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.current_organization_id();
  v_sub public.organization_subscriptions;
  v_next_status text;
  v_keep_active boolean;
begin
  if v_org_id is null or not public.has_organization_role(v_org_id, array['owner', 'admin']) then
    raise exception 'Apenas administradores podem cancelar a assinatura';
  end if;

  select * into v_sub
  from public.organization_subscriptions
  where organization_id = v_org_id
  for update;

  if v_sub.organization_id is null then
    raise exception 'Assinatura não encontrada';
  end if;

  v_keep_active := v_sub.status = 'active'
    and v_sub.current_period_ends_at is not null
    and v_sub.current_period_ends_at > now();

  if v_keep_active then
    v_next_status := 'active';
  elsif v_sub.status = 'trialing' and v_sub.trial_ends_at is not null and v_sub.trial_ends_at > now() then
    v_next_status := 'trialing';
  else
    v_next_status := 'canceled';
  end if;

  update public.organization_subscriptions
  set status = v_next_status,
      cancel_at_period_end = true,
      provider_subscription_id = null,
      provider_checkout_url = null,
      grace_until = null,
      updated_at = now()
  where organization_id = v_org_id;

  insert into public.subscription_audit_logs (
    organization_id, actor_user_id, event_type, previous_status, next_status, details
  ) values (
    v_org_id,
    auth.uid(),
    'subscription_cancel_requested',
    v_sub.status,
    v_next_status,
    jsonb_build_object(
      'keep_until', case when v_keep_active then v_sub.current_period_ends_at else v_sub.trial_ends_at end,
      'reason', nullif(trim(coalesce(p_reason, '')), '')
    )
  );

  return jsonb_build_object(
    'organization_id', v_org_id,
    'status', v_next_status,
    'cancel_at_period_end', true,
    'active_until', case when v_keep_active then v_sub.current_period_ends_at else v_sub.trial_ends_at end
  );
end;
$$;

revoke all on function public.mark_organization_subscription_canceled(text) from public, anon;
grant execute on function public.mark_organization_subscription_canceled(text) to authenticated;

-- Atualiza process_asaas_webhook_event para respeitar o período já pago em SUBSCRIPTION_DELETED/INACTIVATED
-- (enquanto estornos e chargebacks continuam revogando imediatamente).
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
  v_cancel_at_end boolean;
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
  v_cancel_at_end := coalesce(v_sub.cancel_at_period_end, false);

  if p_event_type in ('PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED') then
    v_next_status := 'active';
    v_period_end := greatest(now(), coalesce(p_payment_due_date::timestamptz, now())) + v_cycle_interval + interval '2 days';
    v_grace_until := null;
    v_cancel_at_end := false;
  elsif p_event_type = 'PAYMENT_OVERDUE' then
    v_next_status := 'past_due';
    v_grace_until := now() + interval '3 days';
  elsif p_event_type in ('SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED') then
    v_cancel_at_end := true;
    v_grace_until := null;
    if v_sub.status = 'active' and v_sub.current_period_ends_at is not null and v_sub.current_period_ends_at > now() then
      v_next_status := 'active';
    else
      v_next_status := 'canceled';
    end if;
  elsif p_event_type in ('PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED') then
    v_next_status := 'canceled';
    v_grace_until := null;
    v_cancel_at_end := true;
  end if;

  update public.organization_subscriptions
  set status = v_next_status,
      provider = 'asaas',
      provider_customer_id = coalesce(nullif(trim(coalesce(p_provider_customer_id, '')), ''), provider_customer_id),
      provider_subscription_id = case
        when p_event_type in ('SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED') then null
        else coalesce(nullif(trim(coalesce(p_provider_subscription_id, '')), ''), provider_subscription_id)
      end,
      provider_checkout_url = coalesce(nullif(trim(coalesce(p_invoice_url, '')), ''), provider_checkout_url),
      current_period_ends_at = v_period_end,
      grace_until = v_grace_until,
      cancel_at_period_end = v_cancel_at_end,
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
      'period_ends_at', v_period_end,
      'cancel_at_period_end', v_cancel_at_end
    )
  );

  update public.billing_events set processed_at = now() where id = v_event_row_id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'organization_id', v_org_id,
    'status', v_next_status,
    'cancel_at_period_end', v_cancel_at_end
  );
end;
$$;

-- Hardening multiempresa do NexoFab:
-- 1. Isolamento explícito por current_organization_id() em todas as RPCs SECURITY DEFINER.
-- 2. Contexto seguro para triggers acionados por aprovação pública de propostas.
-- 3. Higiene de search_path, revogação de EXECUTE para PUBLIC e remoção de função legada órfã.
-- 4. Políticas restritas de Storage (bucket_id + role) e validação de perfil ativo/e-mail confirmado nos convites.

-- ============================================================================
-- 1. Funções utilitárias, trigger de tenant e limpeza de função legada
-- ============================================================================

drop function if exists public.assign_quote_organization();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.set_row_organization()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  active_organization uuid := public.current_organization_id();
  trusted_organization uuid;
  raw_trusted_organization text;
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'Não é permitido mover registros entre organizações';
    end if;
    return new;
  end if;

  -- Permite contexto transacional interno apenas quando chamado por rotina SECURITY DEFINER do banco
  -- (ex.: triggers disparados por respond_public_proposal), nunca por chamadas diretas de anon/authenticated.
  if current_user not in ('anon', 'authenticated') then
    raw_trusted_organization := nullif(current_setting('nexofab.system_organization_id', true), '');
    if raw_trusted_organization is not null then
      trusted_organization := raw_trusted_organization::uuid;
      if new.organization_id is null then
        new.organization_id := trusted_organization;
      end if;
      if new.organization_id is distinct from trusted_organization then
        raise exception 'Organização ativa inválida';
      end if;
      return new;
    end if;
  end if;

  if new.organization_id is null then
    new.organization_id := active_organization;
  end if;
  if new.organization_id is null or new.organization_id is distinct from active_organization then
    raise exception 'Organização ativa inválida';
  end if;
  return new;
end;
$$;

-- ============================================================================
-- 2. Triggers encadeados de orçamentos e produção (propagação explícita de tenant)
-- ============================================================================

create or replace function public.notify_quote_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer text;
  v_total numeric;
begin
  if new.status is not distinct from old.status or new.status not in ('aprovado', 'recusado') then
    return new;
  end if;

  v_customer := coalesce(nullif(new.company, ''), nullif(new.customer_name, ''), 'Cliente');
  v_total := coalesce(new.estimated_value, new.subtotal, 0);

  insert into public.management_notifications (organization_id, type, title, message, quote_id, metadata)
  values (
    new.organization_id,
    case when new.status = 'aprovado' then 'proposal_approved' else 'proposal_rejected' end,
    case when new.status = 'aprovado'
      then 'Proposta #' || new.number || ' aprovada'
      else 'Proposta #' || new.number || ' recusada'
    end,
    case when new.status = 'aprovado'
      then v_customer || ' aceitou a proposta no valor de R$ ' || replace(to_char(v_total, 'FM999G999G990D00'), '.', ',') || '.'
      else v_customer || ' recusou a proposta. Entre em contato para entender o motivo.'
    end,
    new.id,
    jsonb_build_object(
      'quoteNumber', new.number,
      'customer', v_customer,
      'phone', coalesce(new.phone, ''),
      'service', coalesce(new.service, ''),
      'value', v_total,
      'status', new.status
    )
  );

  return new;
end;
$$;

revoke all on function public.notify_quote_decision() from public, anon, authenticated;

create or replace function public.capture_quote_approval_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version integer;
  v_items jsonb;
  v_is_team boolean := auth.uid() is not null and public.current_organization_id() = new.organization_id;
begin
  if new.status <> 'aprovado' or old.status is not distinct from new.status then
    return new;
  end if;

  select coalesce(max(version), 0) + 1
    into v_version
  from public.quote_approval_versions
  where quote_id = new.id
    and organization_id = new.organization_id;

  select coalesce(jsonb_agg(to_jsonb(i) order by i.sort_order, i.created_at), '[]'::jsonb)
    into v_items
  from public.quote_items i
  where i.quote_id = new.id
    and i.organization_id = new.organization_id;

  insert into public.quote_approval_versions (
    organization_id, quote_id, version, snapshot, approval_source, approved_by
  ) values (
    new.organization_id,
    new.id,
    v_version,
    (to_jsonb(new) - 'internal_notes') || jsonb_build_object('items', v_items),
    case when v_is_team then 'equipe' else 'cliente' end,
    case when v_is_team then auth.uid() else null end
  );

  return new;
end;
$$;

revoke all on function public.capture_quote_approval_version() from public, anon, authenticated;

create or replace function public.queue_approved_quote_for_production()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_due_at timestamptz;
  v_created_by uuid := case when public.current_organization_id() = new.organization_id then auth.uid() else null end;
begin
  if new.status <> 'aprovado' or old.status is not distinct from new.status then
    return new;
  end if;

  v_due_at := case
    when coalesce(new.delivery_days, 0) > 0 then now() + make_interval(days => new.delivery_days)
    else null
  end;

  insert into public.production_orders (
    organization_id, quote_id, customer_id, title, description, stage, priority, due_at, created_by
  ) values (
    new.organization_id,
    new.id,
    new.customer_id,
    new.service || ' — ' || coalesce(nullif(new.company, ''), new.customer_name),
    coalesce(nullif(new.details, ''), 'Orçamento aceito pelo cliente. Conferir briefing, arquivos, entrada e programar a produção.'),
    'briefing',
    'normal',
    v_due_at,
    v_created_by
  )
  on conflict (quote_id) where quote_id is not null do update set
    customer_id = excluded.customer_id,
    title = excluded.title,
    description = coalesce(public.production_orders.description, excluded.description),
    due_at = coalesce(public.production_orders.due_at, excluded.due_at),
    updated_at = now()
  where public.production_orders.organization_id = excluded.organization_id
    and public.production_orders.stage not in ('concluido', 'cancelado');

  return new;
end;
$$;

revoke all on function public.queue_approved_quote_for_production() from public, anon, authenticated;

create or replace function public.sync_production_material_reservations(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote_id uuid;
  v_org_id uuid;
begin
  select quote_id, organization_id
    into v_quote_id, v_org_id
  from public.production_orders
  where id = p_order_id;

  if v_quote_id is null or v_org_id is null then
    return;
  end if;

  delete from public.production_material_reservations
  where production_order_id = p_order_id
    and organization_id = v_org_id
    and status not in ('consumido', 'liberado');

  insert into public.production_material_reservations (
    organization_id, production_order_id, inventory_item_id, planned_quantity, reserved_quantity, unit, status
  )
  with requirements as (
    select
      i.id as inventory_item_id,
      i.unit as stock_unit,
      sum(greatest(coalesce((usage ->> 'quantity')::numeric, 0), 0)) as planned,
      coalesce(max(nullif(usage ->> 'unit', '')), i.unit) as usage_unit,
      i.current_quantity
    from public.quote_items qi
    cross join lateral jsonb_array_elements(coalesce(qi.pricing_snapshot -> 'stockUsages', '[]'::jsonb)) usage
    join public.inventory_items i
      on i.id = nullif(usage ->> 'materialId', '')::uuid
     and i.organization_id = v_org_id
    where qi.quote_id = v_quote_id
      and qi.organization_id = v_org_id
      and qi.selected_by_customer is not false
      and coalesce((usage ->> 'quantity')::numeric, 0) > 0
    group by i.id, i.unit, i.current_quantity
  ), availability as (
    select
      r.*,
      greatest(r.current_quantity - coalesce((
        select sum(greatest(other.reserved_quantity - other.consumed_quantity, 0))
        from public.production_material_reservations other
        where other.organization_id = v_org_id
          and other.inventory_item_id = r.inventory_item_id
          and other.production_order_id <> p_order_id
          and other.status in ('reservado', 'insuficiente')
      ), 0), 0) as available
    from requirements r
  )
  select
    v_org_id,
    p_order_id,
    inventory_item_id,
    planned,
    least(planned, available),
    usage_unit,
    case when available >= planned then 'reservado' else 'insuficiente' end
  from availability
  on conflict (production_order_id, inventory_item_id) do update set
    planned_quantity = excluded.planned_quantity,
    reserved_quantity = excluded.reserved_quantity,
    unit = excluded.unit,
    status = case
      when public.production_material_reservations.status in ('consumido', 'liberado') then public.production_material_reservations.status
      else excluded.status
    end,
    updated_at = now()
  where public.production_material_reservations.organization_id = v_org_id;
end;
$$;

revoke all on function public.sync_production_material_reservations(uuid) from public, anon, authenticated;
revoke all on function public.sync_new_production_order_reservations() from public, anon, authenticated;

-- ============================================================================
-- 3. RPCs SECURITY DEFINER autenticadas (isolamento explícito por tenant ativo)
-- ============================================================================

create or replace function public.create_payable_with_installments(p_payable jsonb, p_installments jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.current_organization_id();
  v_payable_id uuid;
  v_supplier_id uuid;
  v_category_id uuid;
  v_cost_center_id uuid;
  v_installment jsonb;
  v_total numeric(14,2);
  v_installment_total numeric(14,2);
  v_count integer;
begin
  if v_org_id is null or not public.has_management_role(array['admin', 'financeiro']) then
    raise exception 'Acesso financeiro não autorizado';
  end if;
  if jsonb_typeof(p_installments) <> 'array' then raise exception 'Parcelas inválidas'; end if;

  v_supplier_id := nullif(p_payable ->> 'supplier_id', '')::uuid;
  v_category_id := nullif(p_payable ->> 'expense_category_id', '')::uuid;
  v_cost_center_id := nullif(p_payable ->> 'cost_center_id', '')::uuid;

  if v_supplier_id is not null and not exists (
    select 1 from public.suppliers where id = v_supplier_id and organization_id = v_org_id
  ) then
    raise exception 'Fornecedor não encontrado';
  end if;
  if v_category_id is not null and not exists (
    select 1 from public.expense_categories where id = v_category_id and organization_id = v_org_id
  ) then
    raise exception 'Categoria de despesa não encontrada';
  end if;
  if v_cost_center_id is not null and not exists (
    select 1 from public.cost_centers where id = v_cost_center_id and organization_id = v_org_id
  ) then
    raise exception 'Centro de custo não encontrado';
  end if;

  v_total := (p_payable ->> 'total_amount')::numeric;
  v_count := jsonb_array_length(p_installments);
  select coalesce(sum((value ->> 'amount')::numeric), 0) into v_installment_total from jsonb_array_elements(p_installments);
  if v_count < 1 or v_count > 120 or abs(v_total - v_installment_total) > 0.01 then
    raise exception 'A soma das parcelas precisa corresponder ao valor total';
  end if;

  insert into public.payables (
    organization_id, supplier_id, expense_category_id, cost_center_id, description, document_type,
    document_number, purchase_order, issue_date, competence_date, total_amount,
    installment_count, recurring, recurrence_frequency, recurrence_end_date, notes,
    created_by, updated_by
  ) values (
    v_org_id, v_supplier_id, v_category_id, v_cost_center_id,
    p_payable ->> 'description', p_payable ->> 'document_type',
    nullif(p_payable ->> 'document_number', ''), nullif(p_payable ->> 'purchase_order', ''),
    (p_payable ->> 'issue_date')::date, (p_payable ->> 'competence_date')::date, v_total,
    v_count, coalesce((p_payable ->> 'recurring')::boolean, false),
    nullif(p_payable ->> 'recurrence_frequency', ''), nullif(p_payable ->> 'recurrence_end_date', '')::date,
    nullif(p_payable ->> 'notes', ''), auth.uid(), auth.uid()
  ) returning id into v_payable_id;

  for v_installment in select value from jsonb_array_elements(p_installments)
  loop
    insert into public.payable_installments (
      organization_id, payable_id, installment_number, due_date, amount, payment_method,
      digitable_line, pix_code, document_url
    ) values (
      v_org_id, v_payable_id, (v_installment ->> 'installment_number')::integer,
      (v_installment ->> 'due_date')::date, (v_installment ->> 'amount')::numeric,
      v_installment ->> 'payment_method', nullif(v_installment ->> 'digitable_line', ''),
      nullif(v_installment ->> 'pix_code', ''), nullif(v_installment ->> 'document_url', '')
    );
  end loop;
  return v_payable_id;
end;
$$;

create or replace function public.settle_payable_installment(
  p_installment_id uuid, p_paid_on date, p_paid_amount numeric,
  p_interest numeric, p_fine numeric, p_discount numeric,
  p_bank_account text, p_receipt_url text, p_notes text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.current_organization_id();
begin
  if v_org_id is null or not public.has_management_role(array['admin', 'financeiro']) then
    raise exception 'Acesso financeiro não autorizado';
  end if;
  if p_paid_amount < 0 or p_interest < 0 or p_fine < 0 or p_discount < 0 then
    raise exception 'Valores de pagamento inválidos';
  end if;

  update public.payable_installments set
    status = 'pago', paid_on = p_paid_on, paid_amount = p_paid_amount,
    interest_amount = p_interest, fine_amount = p_fine, discount_amount = p_discount,
    bank_account = nullif(p_bank_account, ''), receipt_url = nullif(p_receipt_url, ''),
    payment_notes = nullif(p_notes, ''), paid_by = auth.uid()
  where id = p_installment_id
    and organization_id = v_org_id
    and status in ('pendente', 'agendado');

  if not found then raise exception 'Parcela não encontrada ou já encerrada'; end if;
end;
$$;

create or replace function public.cancel_payable(p_payable_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.current_organization_id();
begin
  if v_org_id is null or not public.has_management_role(array['admin', 'financeiro']) then
    raise exception 'Acesso financeiro não autorizado';
  end if;

  if exists (
    select 1 from public.payable_installments
    where payable_id = p_payable_id
      and organization_id = v_org_id
      and status = 'pago'
  ) then
    raise exception 'Não é possível cancelar uma conta que possui parcela paga';
  end if;

  update public.payables
  set status = 'cancelado', updated_by = auth.uid()
  where id = p_payable_id
    and organization_id = v_org_id
    and status = 'ativo';

  if not found then raise exception 'Conta não encontrada ou já cancelada'; end if;

  update public.payable_installments
  set status = 'cancelado'
  where payable_id = p_payable_id
    and organization_id = v_org_id
    and status in ('pendente', 'agendado');
end;
$$;

create or replace function public.close_quote_with_deposit(
  p_quote_id uuid,
  p_total_value numeric,
  p_deposit numeric,
  p_payment_method text,
  p_received_on date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.current_organization_id();
  v_quote public.quotes%rowtype;
  v_order_id uuid;
  v_payment_id uuid;
begin
  if v_org_id is null or not public.has_management_role(array['admin', 'comercial', 'financeiro']) then
    raise exception 'Acesso não autorizado';
  end if;
  if p_total_value <= 0 or p_deposit < 0 or p_deposit > p_total_value then
    raise exception 'Valores do fechamento são inválidos';
  end if;
  if p_payment_method not in ('pix', 'dinheiro', 'cartao', 'boleto', 'transferencia', 'outro') then
    raise exception 'Forma de pagamento inválida';
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id and organization_id = v_org_id
  for update;
  if not found then raise exception 'Orçamento não encontrado'; end if;

  update public.quotes
    set status = 'convertido', estimated_value = p_total_value, subtotal = p_total_value
  where id = p_quote_id and organization_id = v_org_id;

  if p_deposit > 0 then
    insert into public.quote_payments (organization_id, quote_id, amount, payment_type, payment_method, received_on, created_by)
    values (v_org_id, p_quote_id, p_deposit, case when p_deposit = p_total_value then 'integral' else 'entrada' end, p_payment_method, p_received_on, auth.uid())
    returning id into v_payment_id;
  end if;

  select id into v_order_id
  from public.production_orders
  where quote_id = p_quote_id and organization_id = v_org_id;

  if v_order_id is null then
    insert into public.production_orders (organization_id, quote_id, customer_id, title, description, stage, created_by)
    values (v_org_id, p_quote_id, v_quote.customer_id, concat(v_quote.service, ' — ', v_quote.customer_name), v_quote.details, 'briefing', auth.uid())
    returning id into v_order_id;
  end if;

  return jsonb_build_object('quoteId', p_quote_id, 'paymentId', v_payment_id, 'productionOrderId', v_order_id);
end;
$$;

create or replace function public.close_quote_with_receivables(
  p_quote_id uuid,
  p_total_value numeric,
  p_deposit numeric,
  p_deposit_method text,
  p_received_on date,
  p_installments jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.current_organization_id();
  v_quote public.quotes%rowtype;
  v_order_id uuid;
  v_payment_id uuid;
  v_installment jsonb;
  v_remaining numeric(14,2);
  v_scheduled_total numeric(14,2);
  v_expected_count integer;
begin
  if v_org_id is null or not public.has_management_role(array['admin', 'comercial', 'financeiro']) then
    raise exception 'Acesso não autorizado';
  end if;
  if p_total_value <= 0 or p_deposit < 0 or p_deposit > p_total_value then raise exception 'Valores do fechamento são inválidos'; end if;
  if p_deposit_method not in ('pix', 'dinheiro', 'cartao', 'boleto', 'transferencia', 'outro') then raise exception 'Forma de pagamento inválida'; end if;
  if jsonb_typeof(p_installments) <> 'array' then raise exception 'Parcelas a receber inválidas'; end if;

  v_remaining := round(p_total_value - p_deposit, 2);
  v_expected_count := jsonb_array_length(p_installments);
  select coalesce(sum((value ->> 'amount')::numeric), 0) into v_scheduled_total from jsonb_array_elements(p_installments);
  if abs(v_remaining - v_scheduled_total) > 0.01 then raise exception 'A soma das parcelas precisa corresponder ao saldo do orçamento'; end if;
  if v_remaining > 0 and (v_expected_count < 1 or v_expected_count > 120) then raise exception 'Informe as parcelas do saldo'; end if;
  if v_remaining = 0 and v_expected_count <> 0 then raise exception 'Não deve haver parcelas quando o pagamento é integral'; end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id and organization_id = v_org_id
  for update;
  if not found then raise exception 'Orçamento não encontrado'; end if;

  if exists (
    select 1 from public.receivable_installments
    where quote_id = p_quote_id and organization_id = v_org_id
  ) then
    raise exception 'Este orçamento já possui contas a receber';
  end if;

  update public.quotes
    set status = 'convertido', estimated_value = p_total_value, subtotal = p_total_value
  where id = p_quote_id and organization_id = v_org_id;

  if p_deposit > 0 then
    insert into public.quote_payments (organization_id, quote_id, amount, payment_type, payment_method, received_on, created_by)
    values (v_org_id, p_quote_id, p_deposit, case when p_deposit = p_total_value then 'integral' else 'entrada' end, p_deposit_method, p_received_on, auth.uid())
    returning id into v_payment_id;

    insert into public.receivable_installments (
      organization_id, quote_id, installment_number, due_date, amount, payment_method, status,
      received_on, received_amount, quote_payment_id, received_by, notes
    ) values (
      v_org_id, p_quote_id, 0, p_received_on, p_deposit, p_deposit_method, 'recebido',
      p_received_on, p_deposit, v_payment_id, auth.uid(), 'Entrada recebida no fechamento'
    );
  end if;

  for v_installment in select value from jsonb_array_elements(p_installments)
  loop
    if (v_installment ->> 'payment_method') not in ('pix', 'dinheiro', 'cartao', 'boleto', 'transferencia', 'outro') then
      raise exception 'Forma de pagamento inválida';
    end if;
    insert into public.receivable_installments (organization_id, quote_id, installment_number, due_date, amount, payment_method, notes)
    values (
      v_org_id, p_quote_id, (v_installment ->> 'installment_number')::integer,
      (v_installment ->> 'due_date')::date, (v_installment ->> 'amount')::numeric,
      v_installment ->> 'payment_method', nullif(v_installment ->> 'notes', '')
    );
  end loop;

  select id into v_order_id
  from public.production_orders
  where quote_id = p_quote_id and organization_id = v_org_id;

  if v_order_id is null then
    insert into public.production_orders (organization_id, quote_id, customer_id, title, description, stage, created_by)
    values (v_org_id, p_quote_id, v_quote.customer_id, concat(v_quote.service, ' — ', v_quote.customer_name), v_quote.details, 'briefing', auth.uid())
    returning id into v_order_id;
  end if;

  return jsonb_build_object('quoteId', p_quote_id, 'paymentId', v_payment_id, 'productionOrderId', v_order_id, 'receivableCount', v_expected_count);
end;
$$;

create or replace function public.settle_receivable_installment(
  p_installment_id uuid, p_received_on date, p_received_amount numeric,
  p_interest numeric, p_fine numeric, p_discount numeric,
  p_bank_account text, p_payment_method text, p_notes text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.current_organization_id();
  v_installment public.receivable_installments%rowtype;
  v_payment_id uuid;
  v_open_count integer;
begin
  if v_org_id is null or not public.has_management_role(array['admin', 'financeiro']) then
    raise exception 'Acesso financeiro não autorizado';
  end if;
  if p_received_amount <= 0 or p_interest < 0 or p_fine < 0 or p_discount < 0 then
    raise exception 'Valores de recebimento inválidos';
  end if;
  if p_payment_method not in ('pix', 'dinheiro', 'cartao', 'boleto', 'transferencia', 'outro') then
    raise exception 'Forma de pagamento inválida';
  end if;

  select * into v_installment
  from public.receivable_installments
  where id = p_installment_id and organization_id = v_org_id
  for update;

  if not found or v_installment.status not in ('pendente', 'agendado') then
    raise exception 'Parcela não encontrada ou já encerrada';
  end if;

  select count(*) into v_open_count
  from public.receivable_installments
  where quote_id = v_installment.quote_id
    and organization_id = v_org_id
    and status in ('pendente', 'agendado');

  insert into public.quote_payments (organization_id, quote_id, amount, payment_type, payment_method, received_on, notes, created_by)
  values (v_org_id, v_installment.quote_id, p_received_amount, case when v_open_count = 1 then 'saldo' else 'parcela' end, p_payment_method, p_received_on, nullif(p_notes, ''), auth.uid())
  returning id into v_payment_id;

  update public.receivable_installments set
    status = 'recebido', received_on = p_received_on, received_amount = p_received_amount,
    interest_amount = p_interest, fine_amount = p_fine, discount_amount = p_discount,
    bank_account = nullif(p_bank_account, ''), payment_method = p_payment_method,
    notes = nullif(p_notes, ''), quote_payment_id = v_payment_id, received_by = auth.uid()
  where id = p_installment_id and organization_id = v_org_id;
end;
$$;

create or replace function public.update_quote_revision(
  p_quote_id uuid,
  p_quote jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.current_organization_id();
  v_quote public.quotes%rowtype;
  v_customer_id uuid;
  v_product_id uuid;
  v_item jsonb;
  v_position integer := 0;
  v_next_status text;
begin
  if v_org_id is null or not public.has_management_role(array['admin', 'comercial']) then
    raise exception 'Acesso não autorizado';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Informe ao menos um item';
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id and organization_id = v_org_id
  for update;
  if not found then raise exception 'Orçamento não encontrado'; end if;
  if v_quote.status = 'convertido' then raise exception 'Um orçamento fechado não pode ser editado'; end if;

  v_customer_id := nullif(p_quote ->> 'customerId', '')::uuid;
  if v_customer_id is not null and not exists (
    select 1 from public.customers where id = v_customer_id and organization_id = v_org_id
  ) then
    raise exception 'Cliente não encontrado';
  end if;

  v_next_status := case when v_quote.status in ('aprovado', 'recusado', 'expirado') then 'em_analise' else v_quote.status end;

  update public.quotes set
    customer_id = v_customer_id,
    customer_name = p_quote ->> 'customerName', company = nullif(p_quote ->> 'company', ''),
    phone = p_quote ->> 'phone', email = nullif(p_quote ->> 'email', ''), service = p_quote ->> 'service',
    dimensions = nullif(p_quote ->> 'dimensions', ''), material = coalesce(nullif(p_quote ->> 'material', ''), 'A definir'),
    details = nullif(p_quote ->> 'details', ''), quantity = greatest(coalesce((p_quote ->> 'quantity')::integer, 1), 1),
    source = p_quote ->> 'source', subtotal = coalesce((p_quote ->> 'subtotal')::numeric, 0),
    discount = coalesce((p_quote ->> 'discount')::numeric, 0), estimated_value = coalesce((p_quote ->> 'estimatedValue')::numeric, 0),
    valid_until = nullif(p_quote ->> 'validUntil', '')::date, payment_terms = nullif(p_quote ->> 'paymentTerms', ''),
    delivery_days = nullif(p_quote ->> 'deliveryDays', '')::integer,
    installation_included = coalesce((p_quote ->> 'installationIncluded')::boolean, false),
    freight = coalesce((p_quote ->> 'freight')::numeric, 0), internal_notes = nullif(p_quote ->> 'internalNotes', ''),
    status = v_next_status
  where id = p_quote_id and organization_id = v_org_id;

  delete from public.quote_items where quote_id = p_quote_id and organization_id = v_org_id;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item ->> 'productId', '')::uuid;
    if v_product_id is not null and not exists (
      select 1 from public.pricing_products where id = v_product_id and organization_id = v_org_id
    ) then
      raise exception 'Produto de precificação não encontrado';
    end if;

    insert into public.quote_items (
      organization_id, quote_id, description, service_type, material, width_mm, height_mm, depth_mm,
      quantity, unit, unit_cost, unit_price, production_notes, pricing_source,
      suggested_unit_price, waste_percent, pricing_snapshot, pricing_product_id,
      option_group, selected_by_customer, sort_order
    ) values (
      v_org_id, p_quote_id, v_item ->> 'description', nullif(v_item ->> 'serviceType', ''), nullif(v_item ->> 'material', ''),
      nullif(v_item ->> 'widthMm', '')::numeric, nullif(v_item ->> 'heightMm', '')::numeric, nullif(v_item ->> 'depthMm', '')::numeric,
      (v_item ->> 'quantity')::numeric, coalesce(nullif(v_item ->> 'unit', ''), 'un'),
      coalesce((v_item ->> 'unitCost')::numeric, 0), coalesce((v_item ->> 'unitPrice')::numeric, 0),
      nullif(v_item ->> 'productionNotes', ''), coalesce(nullif(v_item ->> 'pricingSource', ''), 'manual'),
      nullif(v_item ->> 'suggestedUnitPrice', '')::numeric, nullif(v_item ->> 'wastePercent', '')::numeric,
      v_item -> 'pricingSnapshot', v_product_id,
      nullif(trim(v_item ->> 'optionGroup'), ''), null, v_position
    );
    v_position := v_position + 1;
  end loop;
  return jsonb_build_object('id', p_quote_id, 'status', v_next_status, 'previousStatus', v_quote.status);
end;
$$;

create or replace function public.register_quick_sale(
  p_customer_id uuid,
  p_customer_name text,
  p_phone text,
  p_items jsonb,
  p_payment_status text,
  p_payment_method text,
  p_sale_date date,
  p_due_date date,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.current_organization_id();
  v_quote_id uuid;
  v_quote_number bigint;
  v_order_id uuid;
  v_payment_id uuid;
  v_item jsonb;
  v_total numeric(14,2) := 0;
  v_quantity numeric;
  v_unit_price numeric;
  v_unit_cost numeric;
  v_inventory_id uuid;
  v_stock_quantity numeric;
  v_inventory public.inventory_items%rowtype;
  v_item_count integer;
  v_description text;
begin
  if v_org_id is null or not public.has_management_role(array['admin', 'comercial', 'financeiro']) then
    raise exception 'Acesso não autorizado';
  end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Itens da venda são inválidos'; end if;
  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 20 then raise exception 'Informe de 1 a 20 itens'; end if;
  if p_payment_status not in ('recebido', 'pendente') then raise exception 'Situação do pagamento inválida'; end if;
  if p_payment_method not in ('pix', 'dinheiro', 'cartao', 'boleto', 'transferencia', 'outro') then raise exception 'Forma de pagamento inválida'; end if;
  if p_payment_status = 'pendente' and p_due_date is null then raise exception 'Informe o vencimento da venda a receber'; end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers where id = p_customer_id and organization_id = v_org_id
  ) then
    raise exception 'Cliente não encontrado';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := coalesce((v_item ->> 'quantity')::numeric, 0);
    v_unit_price := coalesce((v_item ->> 'unitPrice')::numeric, 0);
    if length(trim(coalesce(v_item ->> 'description', ''))) < 2 or v_quantity <= 0 or v_unit_price <= 0 then
      raise exception 'Confira descrição, quantidade e preço dos itens';
    end if;
    v_total := v_total + round(v_quantity * v_unit_price, 2);
  end loop;

  v_description := case when v_item_count = 1 then trim(p_items -> 0 ->> 'description') else 'Venda rápida de balcão' end;
  insert into public.quotes (
    organization_id, customer_id, customer_name, phone, service, material, details, quantity,
    status, source, subtotal, discount, estimated_value, internal_notes, created_by
  ) values (
    v_org_id, p_customer_id, coalesce(nullif(trim(p_customer_name), ''), 'Consumidor final'), coalesce(p_phone, ''),
    v_description, 'Venda rápida', nullif(trim(p_notes), ''), 1,
    'convertido', 'presencial', v_total, 0, v_total,
    concat('Venda rápida registrada em ', to_char(p_sale_date, 'DD/MM/YYYY')), auth.uid()
  ) returning id, number into v_quote_id, v_quote_number;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_unit_price := (v_item ->> 'unitPrice')::numeric;
    v_unit_cost := greatest(coalesce((v_item ->> 'unitCost')::numeric, 0), 0);
    v_inventory_id := nullif(v_item ->> 'inventoryItemId', '')::uuid;
    v_stock_quantity := greatest(coalesce((v_item ->> 'stockQuantity')::numeric, 0), 0);

    if v_inventory_id is not null and v_stock_quantity > 0 then
      select * into v_inventory
      from public.inventory_items
      where id = v_inventory_id
        and organization_id = v_org_id
        and active = true
      for update;
      if not found then raise exception 'Insumo de estoque não encontrado'; end if;
      if v_inventory.current_quantity < v_stock_quantity then
        raise exception 'Saldo insuficiente para %: disponível %, necessário %', v_inventory.name, v_inventory.current_quantity, v_stock_quantity;
      end if;
      if v_unit_cost = 0 then v_unit_cost := round((v_inventory.average_cost * v_stock_quantity) / v_quantity, 4); end if;
      update public.inventory_items
      set current_quantity = current_quantity - v_stock_quantity
      where id = v_inventory_id and organization_id = v_org_id;

      insert into public.stock_movements (
        organization_id, inventory_item_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by
      ) values (
        v_org_id, v_inventory_id, 'saida', v_stock_quantity, v_inventory.average_cost, 'quick_sale', v_quote_id,
        concat('Venda rápida #', v_quote_number), auth.uid()
      );
    end if;

    insert into public.quote_items (
      organization_id, quote_id, description, service_type, material, quantity, unit, unit_cost, unit_price,
      production_notes, pricing_source, pricing_snapshot, sort_order
    ) values (
      v_org_id, v_quote_id, trim(v_item ->> 'description'), 'venda_rapida',
      nullif(trim(coalesce(v_item ->> 'materialName', '')), ''), v_quantity,
      coalesce(nullif(trim(v_item ->> 'unit'), ''), 'un'), v_unit_cost, v_unit_price,
      nullif(trim(coalesce(v_item ->> 'notes', '')), ''), 'manual',
      jsonb_build_object(
        'quickSale', true,
        'totalCost', round(v_unit_cost * v_quantity, 2),
        'stockUsages', case when v_inventory_id is not null and v_stock_quantity > 0
          then jsonb_build_array(jsonb_build_object('materialId', v_inventory_id, 'materialName', v_inventory.name, 'quantity', v_stock_quantity, 'unit', v_inventory.unit))
          else '[]'::jsonb end
      ),
      (select count(*) from public.quote_items where quote_id = v_quote_id and organization_id = v_org_id)
    );
  end loop;

  if p_payment_status = 'recebido' then
    insert into public.quote_payments (organization_id, quote_id, amount, payment_type, payment_method, received_on, notes, created_by)
    values (v_org_id, v_quote_id, v_total, 'integral', p_payment_method, p_sale_date, 'Venda rápida recebida', auth.uid())
    returning id into v_payment_id;
    insert into public.receivable_installments (
      organization_id, quote_id, installment_number, due_date, amount, payment_method, status,
      received_on, received_amount, quote_payment_id, received_by, notes
    ) values (
      v_org_id, v_quote_id, 0, p_sale_date, v_total, p_payment_method, 'recebido',
      p_sale_date, v_total, v_payment_id, auth.uid(), 'Venda rápida recebida'
    );
  else
    insert into public.receivable_installments (organization_id, quote_id, installment_number, due_date, amount, payment_method, status, notes)
    values (v_org_id, v_quote_id, 1, p_due_date, v_total, p_payment_method, 'pendente', 'Venda rápida a receber');
  end if;

  insert into public.production_orders (
    organization_id, quote_id, customer_id, title, description, stage, completed_at, created_by
  ) values (
    v_org_id, v_quote_id, p_customer_id, concat(v_description, ' — ', coalesce(nullif(trim(p_customer_name), ''), 'Consumidor final')),
    'Venda rápida já entregue', 'concluido', now(), auth.uid()
  ) returning id into v_order_id;

  return jsonb_build_object(
    'quoteId', v_quote_id, 'quoteNumber', v_quote_number, 'productionOrderId', v_order_id,
    'paymentId', v_payment_id, 'total', v_total, 'paymentStatus', p_payment_status
  );
end;
$$;

-- ============================================================================
-- 4. RPCs públicas (proposta e arte) com search_path completo e contexto seguro
-- ============================================================================

create or replace function public.get_public_proposal(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_quote_id uuid;
  v_org_id uuid;
  v_result jsonb;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;

  select quote_id, organization_id into v_quote_id, v_org_id
  from public.proposal_shares
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and revoked_at is null;
  if v_quote_id is null then return null; end if;

  select jsonb_build_object(
    'id', q.id, 'number', q.number, 'customer_name', q.customer_name, 'company', q.company,
    'service', q.service, 'details', q.details, 'status', q.status, 'subtotal', q.subtotal,
    'discount', q.discount, 'estimated_value', q.estimated_value, 'valid_until', q.valid_until,
    'payment_terms', q.payment_terms, 'delivery_days', q.delivery_days,
    'installation_included', q.installation_included, 'freight', q.freight, 'created_at', q.created_at,
    'issuer', jsonb_build_object(
      'trade_name', o.trade_name, 'legal_name', o.legal_name, 'document', o.document,
      'state_registration', o.state_registration, 'email', o.email, 'phone', o.phone,
      'whatsapp', o.whatsapp, 'website', o.website, 'logo_url', o.logo_url,
      'proposal_footer', o.proposal_footer, 'address_street', o.address_street,
      'address_number', o.address_number, 'address_complement', o.address_complement,
      'address_district', o.address_district, 'address_city', o.address_city,
      'address_state', o.address_state, 'address_zip_code', o.address_zip_code
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'description', i.description, 'service_type', i.service_type,
        'material', i.material, 'width_mm', i.width_mm, 'height_mm', i.height_mm,
        'quantity', i.quantity, 'unit', i.unit, 'unit_price', i.unit_price,
        'total', i.total, 'sort_order', i.sort_order, 'option_group', i.option_group,
        'selected_by_customer', i.selected_by_customer
      ) order by i.sort_order)
      from public.quote_items i
      where i.quote_id = q.id and i.organization_id = q.organization_id
    ), '[]'::jsonb)
  ) into v_result
  from public.quotes q
  join public.organizations o on o.id = q.organization_id
  where q.id = v_quote_id and q.organization_id = v_org_id;
  return v_result;
end;
$$;

create or replace function public.respond_public_proposal(
  p_token text,
  p_decision text,
  p_selected_item_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_quote public.quotes%rowtype;
  v_status text;
  v_subtotal numeric(14,2);
  v_discount numeric(14,2);
begin
  if p_token is null or length(p_token) < 32 then
    return jsonb_build_object('saved', false, 'error', 'Proposta não encontrada.');
  end if;
  if p_decision not in ('aprovar', 'recusar') then
    return jsonb_build_object('saved', false, 'error', 'Resposta inválida.');
  end if;

  select q.* into v_quote
  from public.proposal_shares s
  join public.quotes q
    on q.id = s.quote_id
   and q.organization_id = s.organization_id
  where s.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and s.revoked_at is null
  for update of q;

  if v_quote.id is null then return jsonb_build_object('saved', false, 'error', 'Proposta não encontrada.'); end if;
  if v_quote.status = 'convertido' then return jsonb_build_object('saved', false, 'error', 'Esta proposta já foi convertida em ordem de produção.'); end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then
    return jsonb_build_object('saved', false, 'error', 'Esta proposta está fora da validade. Solicite uma atualização.');
  end if;

  -- Propaga com segurança o tenant validado pelo token aos triggers de notificação, versão e OS.
  perform set_config('nexofab.system_organization_id', v_quote.organization_id::text, true);

  if p_decision = 'aprovar' then
    if exists (
      select 1
      from public.quote_items i
      where i.quote_id = v_quote.id
        and i.organization_id = v_quote.organization_id
        and i.option_group is not null
      group by lower(trim(i.option_group))
      having count(*) filter (where i.id = any(coalesce(p_selected_item_ids, array[]::uuid[]))) <> 1
    ) then
      perform set_config('nexofab.system_organization_id', '', true);
      return jsonb_build_object('saved', false, 'error', 'Escolha uma opção em cada grupo antes de aprovar.');
    end if;

    if exists (
      select 1 from unnest(coalesce(p_selected_item_ids, array[]::uuid[])) selected_id
      where not exists (
        select 1 from public.quote_items i
        where i.id = selected_id
          and i.quote_id = v_quote.id
          and i.organization_id = v_quote.organization_id
          and i.option_group is not null
      )
    ) then
      perform set_config('nexofab.system_organization_id', '', true);
      return jsonb_build_object('saved', false, 'error', 'Uma das opções selecionadas não pertence a esta proposta.');
    end if;

    update public.quote_items
    set selected_by_customer = case
      when option_group is null then true
      else id = any(coalesce(p_selected_item_ids, array[]::uuid[]))
    end
    where quote_id = v_quote.id and organization_id = v_quote.organization_id;

    select coalesce(sum(total), 0) into v_subtotal
    from public.quote_items
    where quote_id = v_quote.id
      and organization_id = v_quote.organization_id
      and selected_by_customer is true;

    v_discount := least(coalesce(v_quote.discount, 0), v_subtotal);
    v_status := 'aprovado';

    update public.quotes
    set status = v_status,
        subtotal = v_subtotal,
        discount = v_discount,
        estimated_value = greatest(0, v_subtotal + coalesce(freight, 0) - v_discount)
    where id = v_quote.id and organization_id = v_quote.organization_id;
  else
    v_status := 'recusado';
    update public.quotes
    set status = v_status
    where id = v_quote.id and organization_id = v_quote.organization_id;
  end if;

  perform set_config('nexofab.system_organization_id', '', true);
  return jsonb_build_object('saved', true, 'status', v_status);
end;
$$;

create or replace function public.respond_public_artwork(p_token text, p_decision text, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_status text;
begin
  if p_token is null or length(p_token) < 32 then
    return jsonb_build_object('saved', false, 'error', 'Esta arte já foi respondida ou o link é inválido.');
  end if;
  if p_decision not in ('aprovada', 'ajustes') then
    return jsonb_build_object('saved', false, 'error', 'Resposta inválida.');
  end if;

  update public.production_artwork_approvals
  set status = p_decision,
      customer_notes = nullif(trim(p_notes), ''),
      responded_at = now()
  where public_token = p_token
    and status = 'aguardando'
  returning id, status into v_id, v_status;

  if v_id is null then
    return jsonb_build_object('saved', false, 'error', 'Esta arte já foi respondida ou o link é inválido.');
  end if;
  return jsonb_build_object('saved', true, 'status', v_status);
end;
$$;

revoke all on function public.get_public_proposal(text) from public;
revoke all on function public.respond_public_proposal(text, text, uuid[]) from public;
revoke all on function public.get_public_artwork(text) from public;
revoke all on function public.respond_public_artwork(text, text, text) from public;
grant execute on function public.get_public_proposal(text) to anon, authenticated;
grant execute on function public.respond_public_proposal(text, text, uuid[]) to anon, authenticated;
grant execute on function public.get_public_artwork(text) to anon, authenticated;
grant execute on function public.respond_public_artwork(text, text, text) to anon, authenticated;

-- ============================================================================
-- 5. Organizações e convites: perfil ativo, e-mail confirmado e escopo de revogação
-- ============================================================================

create or replace function public.create_organization(p_trade_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid;
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

  update public.profiles
  set active_organization_id = v_organization_id, updated_at = now()
  where id = auth.uid();

  return v_organization_id;
end;
$$;

create or replace function public.set_active_organization(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and active
  ) then
    raise exception 'Autenticação obrigatória';
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id
      and user_id = auth.uid()
      and status = 'active'
  ) then
    raise exception 'Usuário não pertence a esta organização';
  end if;

  update public.profiles
  set active_organization_id = p_organization_id, updated_at = now()
  where id = auth.uid();
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
  existing_role text;
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

  select role into existing_role
  from public.organization_members
  where organization_id = invitation.organization_id and user_id = auth.uid();

  insert into public.organization_members(organization_id, user_id, role, status, invited_by)
  values (invitation.organization_id, auth.uid(), invitation.role, 'active', invitation.invited_by)
  on conflict (organization_id, user_id) do update set
    role = case when existing_role = 'owner' then 'owner' else excluded.role end,
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

create or replace function public.revoke_organization_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid := public.current_organization_id();
begin
  if v_organization_id is null or not public.has_organization_role(v_organization_id, array['owner','admin']) then
    raise exception 'Convite não encontrado';
  end if;

  update public.organization_invitations
  set status = 'revoked', updated_at = now()
  where id = p_invitation_id
    and organization_id = v_organization_id
    and status = 'pending';

  if not found then
    raise exception 'Convite não encontrado';
  end if;
end;
$$;

-- ============================================================================
-- 6. Storage: restringir bucket_id e papel em UPDATE e DELETE
-- ============================================================================

drop policy if exists "tenant_storage_update" on storage.objects;
create policy "tenant_storage_update" on storage.objects
for update to authenticated
using (
  bucket_id in ('artes-clientes','financeiro-documentos','artes-aprovacao','company-assets')
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner','admin','comercial','producao','estoque','financeiro'])
)
with check (
  bucket_id in ('artes-clientes','financeiro-documentos','artes-aprovacao','company-assets')
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner','admin','comercial','producao','estoque','financeiro'])
);

drop policy if exists "tenant_storage_delete" on storage.objects;
create policy "tenant_storage_delete" on storage.objects
for delete to authenticated
using (
  bucket_id in ('artes-clientes','financeiro-documentos','artes-aprovacao','company-assets')
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner','admin','comercial','producao','estoque','financeiro'])
);

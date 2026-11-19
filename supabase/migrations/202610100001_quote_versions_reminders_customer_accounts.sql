alter table public.customers
  add column if not exists billing_cycle text not null default 'imediato'
    check (billing_cycle in ('imediato', 'semanal', 'mensal')),
  add column if not exists billing_weekday smallint
    check (billing_weekday is null or billing_weekday between 1 and 6),
  add column if not exists billing_day smallint
    check (billing_day is null or billing_day between 1 and 28),
  add column if not exists credit_limit numeric(14,2) not null default 0
    check (credit_limit >= 0),
  add column if not exists billing_notes text;

create table if not exists public.quote_approval_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete restrict,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  approval_source text not null default 'equipe' check (approval_source in ('cliente', 'equipe')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz not null default now(),
  unique (quote_id, version)
);

create index if not exists quote_approval_versions_quote_idx
  on public.quote_approval_versions (quote_id, version desc);

alter table public.quote_approval_versions enable row level security;
grant select on table public.quote_approval_versions to authenticated;

drop policy if exists "management_read_quote_approval_versions" on public.quote_approval_versions;
create policy "management_read_quote_approval_versions"
  on public.quote_approval_versions for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'financeiro', 'producao']));

create or replace function public.capture_quote_approval_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version integer;
  v_items jsonb;
begin
  if new.status <> 'aprovado' or old.status is not distinct from new.status then
    return new;
  end if;

  select coalesce(max(version), 0) + 1
    into v_version
  from public.quote_approval_versions
  where quote_id = new.id;

  select coalesce(jsonb_agg(to_jsonb(i) order by i.sort_order, i.created_at), '[]'::jsonb)
    into v_items
  from public.quote_items i
  where i.quote_id = new.id;

  insert into public.quote_approval_versions (
    quote_id, version, snapshot, approval_source, approved_by
  ) values (
    new.id,
    v_version,
    (to_jsonb(new) - 'internal_notes') || jsonb_build_object('items', v_items),
    case when auth.uid() is null then 'cliente' else 'equipe' end,
    auth.uid()
  );

  return new;
end;
$$;

drop trigger if exists capture_quote_approval_version on public.quotes;
create trigger capture_quote_approval_version
after update of status on public.quotes
for each row execute function public.capture_quote_approval_version();

-- Preserva também os orçamentos que já estavam aprovados quando esta evolução foi instalada.
insert into public.quote_approval_versions (
  quote_id, version, snapshot, approval_source, approved_at
)
select
  q.id,
  1,
  (to_jsonb(q) - 'internal_notes') || jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.sort_order, i.created_at)
      from public.quote_items i
      where i.quote_id = q.id
    ), '[]'::jsonb)
  ),
  'equipe',
  coalesce(q.updated_at, q.created_at, now())
from public.quotes q
where q.status = 'aprovado'
  and not exists (
    select 1 from public.quote_approval_versions v where v.quote_id = q.id
  );

create index if not exists customers_billing_cycle_idx
  on public.customers (billing_cycle) where active = true;

create index if not exists receivable_installments_open_quote_idx
  on public.receivable_installments (quote_id, due_date)
  where status in ('pendente', 'agendado');

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
  v_quote public.quotes%rowtype;
  v_item jsonb;
  v_position integer := 0;
  v_next_status text;
begin
  if not public.has_management_role(array['admin', 'comercial']) then
    raise exception 'Acesso não autorizado';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Informe ao menos um item';
  end if;

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Orçamento não encontrado'; end if;
  if v_quote.status = 'convertido' then raise exception 'Um orçamento fechado não pode ser editado'; end if;

  v_next_status := case when v_quote.status in ('aprovado', 'recusado', 'expirado') then 'em_analise' else v_quote.status end;

  update public.quotes set
    customer_id = nullif(p_quote ->> 'customerId', '')::uuid,
    customer_name = p_quote ->> 'customerName',
    company = nullif(p_quote ->> 'company', ''),
    phone = p_quote ->> 'phone',
    email = nullif(p_quote ->> 'email', ''),
    service = p_quote ->> 'service',
    dimensions = nullif(p_quote ->> 'dimensions', ''),
    material = coalesce(nullif(p_quote ->> 'material', ''), 'A definir'),
    details = nullif(p_quote ->> 'details', ''),
    quantity = greatest(coalesce((p_quote ->> 'quantity')::integer, 1), 1),
    source = p_quote ->> 'source',
    subtotal = coalesce((p_quote ->> 'subtotal')::numeric, 0),
    discount = coalesce((p_quote ->> 'discount')::numeric, 0),
    estimated_value = coalesce((p_quote ->> 'estimatedValue')::numeric, 0),
    valid_until = nullif(p_quote ->> 'validUntil', '')::date,
    payment_terms = nullif(p_quote ->> 'paymentTerms', ''),
    delivery_days = nullif(p_quote ->> 'deliveryDays', '')::integer,
    installation_included = coalesce((p_quote ->> 'installationIncluded')::boolean, false),
    freight = coalesce((p_quote ->> 'freight')::numeric, 0),
    internal_notes = nullif(p_quote ->> 'internalNotes', ''),
    status = v_next_status
  where id = p_quote_id;

  delete from public.quote_items where quote_id = p_quote_id;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.quote_items (
      quote_id, description, service_type, material, width_mm, height_mm, depth_mm,
      quantity, unit, unit_cost, unit_price, production_notes, pricing_source,
      suggested_unit_price, waste_percent, pricing_snapshot, pricing_product_id, sort_order
    ) values (
      p_quote_id, v_item ->> 'description', nullif(v_item ->> 'serviceType', ''), nullif(v_item ->> 'material', ''),
      nullif(v_item ->> 'widthMm', '')::numeric, nullif(v_item ->> 'heightMm', '')::numeric, nullif(v_item ->> 'depthMm', '')::numeric,
      (v_item ->> 'quantity')::numeric, coalesce(nullif(v_item ->> 'unit', ''), 'un'),
      coalesce((v_item ->> 'unitCost')::numeric, 0), coalesce((v_item ->> 'unitPrice')::numeric, 0),
      nullif(v_item ->> 'productionNotes', ''), coalesce(nullif(v_item ->> 'pricingSource', ''), 'manual'),
      nullif(v_item ->> 'suggestedUnitPrice', '')::numeric, nullif(v_item ->> 'wastePercent', '')::numeric,
      v_item -> 'pricingSnapshot', nullif(v_item ->> 'productId', '')::uuid, v_position
    );
    v_position := v_position + 1;
  end loop;

  return jsonb_build_object('id', p_quote_id, 'status', v_next_status, 'previousStatus', v_quote.status);
end;
$$;

revoke all on function public.update_quote_revision(uuid, jsonb, jsonb) from public;
grant execute on function public.update_quote_revision(uuid, jsonb, jsonb) to authenticated;

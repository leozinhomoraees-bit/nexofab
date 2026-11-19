alter table public.production_orders
  add column if not exists scheduled_start_at timestamptz;

create table if not exists public.production_material_reservations (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  planned_quantity numeric(14,6) not null check (planned_quantity > 0),
  reserved_quantity numeric(14,6) not null check (reserved_quantity >= 0),
  consumed_quantity numeric(14,6) not null default 0 check (consumed_quantity >= 0),
  unit text not null default 'un',
  status text not null default 'reservado' check (status in ('reservado', 'insuficiente', 'consumido', 'liberado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (production_order_id, inventory_item_id)
);

create table if not exists public.production_actual_entries (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  entry_type text not null check (entry_type in ('mao_obra', 'maquina', 'material', 'perda', 'retrabalho', 'terceiro', 'outro')),
  description text not null,
  quantity numeric(14,4) not null default 1 check (quantity > 0),
  unit text not null default 'un',
  unit_cost numeric(14,4) not null default 0 check (unit_cost >= 0),
  total_cost numeric(14,2) generated always as (round(quantity * unit_cost, 2)) stored,
  notes text,
  occurred_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists production_reservations_order_idx on public.production_material_reservations (production_order_id, status);
create index if not exists production_reservations_item_idx on public.production_material_reservations (inventory_item_id, status);
create index if not exists production_actual_entries_order_idx on public.production_actual_entries (production_order_id, occurred_at desc);

alter table public.production_material_reservations enable row level security;
alter table public.production_actual_entries enable row level security;
grant select, insert, update, delete on public.production_material_reservations to authenticated;
grant select, insert, update, delete on public.production_actual_entries to authenticated;

drop policy if exists "management_production_reservations" on public.production_material_reservations;
create policy "management_production_reservations" on public.production_material_reservations
  for all to authenticated
  using (public.has_management_role(array['admin', 'producao', 'estoque', 'comercial']))
  with check (public.has_management_role(array['admin', 'producao', 'estoque', 'comercial']));

drop policy if exists "management_production_actual_entries" on public.production_actual_entries;
create policy "management_production_actual_entries" on public.production_actual_entries
  for all to authenticated
  using (public.has_management_role(array['admin', 'producao', 'financeiro']))
  with check (public.has_management_role(array['admin', 'producao', 'financeiro']));

create or replace function public.sync_production_material_reservations(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote_id uuid;
begin
  select quote_id into v_quote_id from public.production_orders where id = p_order_id;
  if v_quote_id is null then return; end if;

  delete from public.production_material_reservations
  where production_order_id = p_order_id and status not in ('consumido', 'liberado');

  insert into public.production_material_reservations (production_order_id, inventory_item_id, planned_quantity, reserved_quantity, unit, status)
  with requirements as (
    select i.id inventory_item_id, i.unit stock_unit,
      sum(greatest(coalesce((usage ->> 'quantity')::numeric, 0), 0)) planned,
      coalesce(max(nullif(usage ->> 'unit', '')), i.unit) usage_unit,
      i.current_quantity
    from public.quote_items qi
    cross join lateral jsonb_array_elements(coalesce(qi.pricing_snapshot -> 'stockUsages', '[]'::jsonb)) usage
    join public.inventory_items i on i.id = nullif(usage ->> 'materialId', '')::uuid
    where qi.quote_id = v_quote_id and qi.selected_by_customer is not false and coalesce((usage ->> 'quantity')::numeric, 0) > 0
    group by i.id, i.unit, i.current_quantity
  ), availability as (
    select r.*, greatest(r.current_quantity - coalesce((
      select sum(greatest(other.reserved_quantity - other.consumed_quantity, 0))
      from public.production_material_reservations other
      where other.inventory_item_id = r.inventory_item_id and other.production_order_id <> p_order_id and other.status in ('reservado', 'insuficiente')
    ), 0), 0) available
    from requirements r
  )
  select p_order_id, inventory_item_id, planned, least(planned, available), usage_unit,
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
    updated_at = now();
end;
$$;

create or replace function public.sync_new_production_order_reservations()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.sync_production_material_reservations(new.id);
  return new;
end;
$$;

drop trigger if exists sync_new_production_order_reservations on public.production_orders;
create trigger sync_new_production_order_reservations
after insert or update of quote_id on public.production_orders
for each row execute function public.sync_new_production_order_reservations();

select public.sync_production_material_reservations(id)
from public.production_orders
where quote_id is not null and stage not in ('concluido', 'cancelado');

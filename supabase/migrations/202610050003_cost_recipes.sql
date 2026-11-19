alter table public.pricing_machine_consumables
  drop constraint if exists pricing_machine_consumables_calculation_basis_check;

alter table public.pricing_machine_consumables
  add column if not exists useful_life_months numeric(12,3) check (useful_life_months is null or useful_life_months > 0),
  add constraint pricing_machine_consumables_calculation_basis_check
    check (calculation_basis in ('hora', 'm2', 'mes'));

alter table public.pricing_settings
  add column if not exists productive_hours_month numeric(10,2) not null default 160 check (productive_hours_month > 0),
  add column if not exists maximum_margin_percent numeric(7,3) not null default 45 check (maximum_margin_percent between 0 and 90);

create table public.pricing_fixed_costs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  monthly_amount numeric(14,2) not null default 0 check (monthly_amount >= 0),
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pricing_product_components (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.pricing_products(id) on delete cascade,
  material_id uuid references public.pricing_materials(id) on delete set null,
  name text not null,
  calculation_basis text not null check (calculation_basis in ('net_m2', 'width_m', 'height_m', 'unit', 'fixed')),
  quantity_factor numeric(14,6) not null default 1 check (quantity_factor >= 0),
  extra_quantity numeric(14,6) not null default 0 check (extra_quantity >= 0),
  waste_percent numeric(7,3) not null default 0 check (waste_percent between 0 and 100),
  optional boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pricing_fixed_costs_active_idx on public.pricing_fixed_costs (active, name);
create index pricing_product_components_product_idx on public.pricing_product_components (product_id, active, sort_order);

create trigger pricing_fixed_costs_updated_at before update on public.pricing_fixed_costs for each row execute function public.set_updated_at();
create trigger pricing_product_components_updated_at before update on public.pricing_product_components for each row execute function public.set_updated_at();

alter table public.pricing_fixed_costs enable row level security;
alter table public.pricing_product_components enable row level security;
grant select, insert, update, delete on table public.pricing_fixed_costs, public.pricing_product_components to authenticated;

create policy "management_read_pricing_fixed_costs" on public.pricing_fixed_costs for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']));
create policy "admin_manage_pricing_fixed_costs" on public.pricing_fixed_costs for all to authenticated
  using (public.has_management_role(array['admin'])) with check (public.has_management_role(array['admin']));
create policy "management_read_product_components" on public.pricing_product_components for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']));
create policy "commercial_manage_product_components" on public.pricing_product_components for all to authenticated
  using (public.has_management_role(array['admin', 'comercial'])) with check (public.has_management_role(array['admin', 'comercial']));

-- Fichas técnicas e consumíveis pertencem ao tenant e começam vazios.

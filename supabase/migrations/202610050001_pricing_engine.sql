create table public.pricing_materials (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  category text not null check (category in ('lona', 'vinil', 'papel', 'tecido', 'chapa', 'tinta', 'filamento', 'acabamento', 'estrutura', 'embalagem', 'consumivel', 'terceirizado', 'outro')),
  format text not null check (format in ('rolo', 'chapa', 'unidade', 'litro', 'kg', 'metro', 'servico')),
  supplier text,
  package_cost numeric(14,4) not null default 0 check (package_cost >= 0),
  purchase_quantity numeric(14,4) not null default 1 check (purchase_quantity > 0),
  width_mm numeric(12,2) check (width_mm is null or width_mm > 0),
  usable_width_mm numeric(12,2) check (usable_width_mm is null or usable_width_mm > 0),
  height_mm numeric(12,2) check (height_mm is null or height_mm > 0),
  length_m numeric(12,3) check (length_m is null or length_m > 0),
  thickness_mm numeric(10,3) check (thickness_mm is null or thickness_mm > 0),
  default_waste_percent numeric(7,3) not null default 0 check (default_waste_percent between 0 and 100),
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pricing_machines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  machine_type text not null check (machine_type in ('grandes_formatos', 'router_cnc', 'laser', 'impressora_3d', 'plotter', 'laminadora', 'acabamento', 'outro')),
  purchase_cost numeric(14,2) not null default 0 check (purchase_cost >= 0),
  residual_value numeric(14,2) not null default 0 check (residual_value >= 0),
  useful_life_months integer not null default 60 check (useful_life_months > 0),
  productive_hours_month numeric(10,2) not null default 120 check (productive_hours_month > 0),
  maintenance_monthly numeric(14,2) not null default 0 check (maintenance_monthly >= 0),
  power_kw numeric(10,3) not null default 0 check (power_kw >= 0),
  setup_minutes numeric(10,2) not null default 0 check (setup_minutes >= 0),
  speed_m2_hour numeric(12,3) check (speed_m2_hour is null or speed_m2_hour > 0),
  minimum_minutes numeric(10,2) not null default 0 check (minimum_minutes >= 0),
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (residual_value <= purchase_cost)
);

create table public.pricing_machine_consumables (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.pricing_machines(id) on delete cascade,
  material_id uuid references public.pricing_materials(id) on delete set null,
  name text not null,
  calculation_basis text not null check (calculation_basis in ('hora', 'm2')),
  replacement_cost numeric(14,4) not null default 0 check (replacement_cost >= 0),
  useful_life_hours numeric(12,3) check (useful_life_hours is null or useful_life_hours > 0),
  consumption_per_m2 numeric(14,6) check (consumption_per_m2 is null or consumption_per_m2 >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pricing_settings (
  id text primary key default 'default' check (id = 'default'),
  electricity_price_kwh numeric(12,4) not null default 0 check (electricity_price_kwh >= 0),
  labor_cost_hour numeric(12,2) not null default 0 check (labor_cost_hour >= 0),
  overhead_hour numeric(12,2) not null default 0 check (overhead_hour >= 0),
  tax_percent numeric(7,3) not null default 0 check (tax_percent between 0 and 100),
  commission_percent numeric(7,3) not null default 0 check (commission_percent between 0 and 100),
  contingency_percent numeric(7,3) not null default 0 check (contingency_percent between 0 and 100),
  target_margin_percent numeric(7,3) not null default 0 check (target_margin_percent between 0 and 100),
  minimum_order_value numeric(14,2) not null default 0 check (minimum_order_value >= 0),
  rounding_increment numeric(10,2) not null default 0.01 check (rounding_increment > 0),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.quote_items
  add column if not exists pricing_source text not null default 'manual' check (pricing_source in ('manual', 'calculado')),
  add column if not exists suggested_unit_price numeric(14,4) check (suggested_unit_price is null or suggested_unit_price >= 0),
  add column if not exists waste_percent numeric(7,3) check (waste_percent is null or waste_percent between 0 and 100),
  add column if not exists pricing_snapshot jsonb;

create index pricing_materials_category_idx on public.pricing_materials (category, active);
create index pricing_machines_type_idx on public.pricing_machines (machine_type, active);
create index pricing_consumables_machine_idx on public.pricing_machine_consumables (machine_id, active);

create trigger pricing_materials_updated_at before update on public.pricing_materials for each row execute function public.set_updated_at();
create trigger pricing_machines_updated_at before update on public.pricing_machines for each row execute function public.set_updated_at();
create trigger pricing_machine_consumables_updated_at before update on public.pricing_machine_consumables for each row execute function public.set_updated_at();
create trigger pricing_settings_updated_at before update on public.pricing_settings for each row execute function public.set_updated_at();

alter table public.pricing_materials enable row level security;
alter table public.pricing_machines enable row level security;
alter table public.pricing_machine_consumables enable row level security;
alter table public.pricing_settings enable row level security;

grant select on table public.pricing_materials, public.pricing_machines, public.pricing_machine_consumables, public.pricing_settings to authenticated;
grant insert, update, delete on table public.pricing_materials, public.pricing_machines, public.pricing_machine_consumables to authenticated;
grant insert, update on table public.pricing_settings to authenticated;

create policy "management_read_pricing_materials" on public.pricing_materials for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']));
create policy "pricing_team_manage_materials" on public.pricing_materials for all to authenticated
  using (public.has_management_role(array['admin', 'estoque']))
  with check (public.has_management_role(array['admin', 'estoque']));

create policy "management_read_pricing_machines" on public.pricing_machines for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']));
create policy "pricing_team_manage_machines" on public.pricing_machines for all to authenticated
  using (public.has_management_role(array['admin', 'producao']))
  with check (public.has_management_role(array['admin', 'producao']));

create policy "management_read_machine_consumables" on public.pricing_machine_consumables for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']));
create policy "pricing_team_manage_machine_consumables" on public.pricing_machine_consumables for all to authenticated
  using (public.has_management_role(array['admin', 'producao', 'estoque']))
  with check (public.has_management_role(array['admin', 'producao', 'estoque']));

create policy "management_read_pricing_settings" on public.pricing_settings for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']));
create policy "admin_manage_pricing_settings" on public.pricing_settings for all to authenticated
  using (public.has_management_role(array['admin']))
  with check (public.has_management_role(array['admin']));

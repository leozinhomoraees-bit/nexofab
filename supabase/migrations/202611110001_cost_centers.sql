create table if not exists public.pricing_cost_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  productive_hours_month numeric(10,2) not null default 160 check (productive_hours_month > 0),
  is_default boolean not null default false,
  notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pricing_cost_centers_one_default_idx
  on public.pricing_cost_centers (is_default)
  where is_default = true and active = true;

alter table public.pricing_machines
  add column if not exists cost_center_id uuid references public.pricing_cost_centers(id) on delete set null;

alter table public.pricing_fixed_costs
  add column if not exists cost_center_id uuid references public.pricing_cost_centers(id) on delete set null;

create index if not exists pricing_machines_cost_center_idx on public.pricing_machines(cost_center_id) where active = true;
create index if not exists pricing_fixed_costs_cost_center_idx on public.pricing_fixed_costs(cost_center_id) where active = true;

alter table public.pricing_cost_centers enable row level security;

drop policy if exists "management_read_pricing_cost_centers" on public.pricing_cost_centers;
create policy "management_read_pricing_cost_centers"
  on public.pricing_cost_centers for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'financeiro', 'producao', 'estoque']));

drop policy if exists "admin_manage_pricing_cost_centers" on public.pricing_cost_centers;
create policy "admin_manage_pricing_cost_centers"
  on public.pricing_cost_centers for all to authenticated
  using (public.has_management_role(array['admin']))
  with check (public.has_management_role(array['admin']));

grant select on table public.pricing_cost_centers to authenticated;
grant insert, update, delete on table public.pricing_cost_centers to authenticated;

comment on table public.pricing_cost_centers is
  'Centros opcionais para distribuir custos fixos. Sem centro ativo/vinculado, a precificação mantém o rateio global legado.';

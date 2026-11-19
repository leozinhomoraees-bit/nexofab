create table public.pricing_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text,
  pricing_method text not null default 'cost_margin' check (pricing_method in ('cost_margin', 'table', 'higher_of')),
  rate_basis text not null default 'm2' check (rate_basis in ('m2', 'linear_meter', 'unit', 'fixed')),
  sale_rate numeric(14,4) not null default 0 check (sale_rate >= 0),
  minimum_price numeric(14,2) not null default 0 check (minimum_price >= 0),
  rounding_increment numeric(10,2) not null default 0.01 check (rounding_increment > 0),
  default_labor_minutes numeric(10,2) not null default 0 check (default_labor_minutes >= 0),
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quote_items
  add column if not exists pricing_product_id uuid references public.pricing_products(id) on delete set null;

create index pricing_products_category_idx on public.pricing_products (category, active);
create index quote_items_pricing_product_idx on public.quote_items (pricing_product_id);
create trigger pricing_products_updated_at before update on public.pricing_products for each row execute function public.set_updated_at();

alter table public.pricing_products enable row level security;
grant select, insert, update, delete on table public.pricing_products to authenticated;

create policy "management_read_pricing_products" on public.pricing_products for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']));
create policy "commercial_manage_pricing_products" on public.pricing_products for all to authenticated
  using (public.has_management_role(array['admin', 'comercial']))
  with check (public.has_management_role(array['admin', 'comercial']));

-- Catálogos, custos e preços são configurados por cada organização.

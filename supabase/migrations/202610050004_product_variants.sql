alter table public.pricing_products
  add column if not exists default_material_id uuid references public.pricing_materials(id) on delete set null,
  add column if not exists default_machine_id uuid references public.pricing_machines(id) on delete set null;

create index if not exists pricing_products_default_material_idx on public.pricing_products (default_material_id);
create index if not exists pricing_products_default_machine_idx on public.pricing_products (default_machine_id);

comment on column public.pricing_products.default_material_id is
  'Insumo principal utilizado automaticamente ao calcular esta variação de produto.';
comment on column public.pricing_products.default_machine_id is
  'Máquina utilizada automaticamente ao calcular esta variação de produto.';

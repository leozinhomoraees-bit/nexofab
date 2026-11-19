create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'comercial' check (role in ('admin', 'comercial', 'producao', 'estoque', 'financeiro')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  person_type text not null default 'empresa' check (person_type in ('pessoa', 'empresa')),
  name text not null,
  company_name text,
  document text,
  email text,
  phone text,
  whatsapp text,
  address jsonb not null default '{}'::jsonb,
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  company text,
  phone text not null,
  email text,
  service text not null,
  dimensions text,
  material text not null default 'A definir',
  details text,
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'novo' check (status in ('novo', 'em_analise', 'aguardando_cliente', 'aprovado', 'recusado', 'expirado', 'convertido')),
  source text not null default 'interno' check (source in ('site', 'whatsapp', 'telefone', 'presencial', 'interno', 'outro')),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  estimated_value numeric(12,2),
  valid_until date,
  internal_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  service_type text,
  material text,
  width_mm numeric(12,2),
  height_mm numeric(12,2),
  depth_mm numeric(12,2),
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit text not null default 'un',
  unit_cost numeric(12,4) not null default 0,
  unit_price numeric(12,4) not null default 0,
  total numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  production_notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  category text,
  description text,
  unit text not null default 'un',
  current_quantity numeric(14,3) not null default 0,
  minimum_quantity numeric(14,3) not null default 0,
  average_cost numeric(14,4) not null default 0,
  location text,
  supplier text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  movement_type text not null check (movement_type in ('entrada', 'saida', 'ajuste', 'reserva', 'liberacao')),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,4),
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.production_orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  quote_id uuid references public.quotes(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  title text not null,
  description text,
  stage text not null default 'briefing' check (stage in ('briefing', 'arte', 'aprovacao', 'producao', 'acabamento', 'expedicao', 'instalacao', 'concluido', 'cancelado')),
  priority text not null default 'normal' check (priority in ('baixa', 'normal', 'alta', 'urgente')),
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  responsible_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.production_tasks (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  title text not null,
  machine text check (machine is null or machine in ('router_cnc', 'laser', 'impressora_3d', 'grandes_formatos', 'acabamento', 'terceirizado', 'outro')),
  status text not null default 'pendente' check (status in ('pendente', 'em_execucao', 'pausada', 'concluida', 'cancelada')),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  actual_minutes integer check (actual_minutes is null or actual_minutes >= 0),
  responsible_id uuid references public.profiles(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('customer', 'quote', 'production_order', 'production_task')),
  entity_id uuid not null,
  bucket text not null default 'artes-clientes',
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index quotes_created_at_idx on public.quotes (created_at desc);
create index quotes_status_idx on public.quotes (status);
create index quotes_customer_id_idx on public.quotes (customer_id);
create index customers_name_idx on public.customers using gin (to_tsvector('portuguese', coalesce(name, '') || ' ' || coalesce(company_name, '')));
create index inventory_items_category_idx on public.inventory_items (category);
create index inventory_items_sku_idx on public.inventory_items (sku);
create index production_orders_stage_due_idx on public.production_orders (stage, due_at);
create index production_tasks_order_idx on public.production_tasks (production_order_id, sort_order);
create index stock_movements_item_created_idx on public.stock_movements (inventory_item_id, created_at desc);

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger quotes_updated_at before update on public.quotes for each row execute function public.set_updated_at();
create trigger quote_items_updated_at before update on public.quote_items for each row execute function public.set_updated_at();
create trigger inventory_items_updated_at before update on public.inventory_items for each row execute function public.set_updated_at();
create trigger production_orders_updated_at before update on public.production_orders for each row execute function public.set_updated_at();
create trigger production_tasks_updated_at before update on public.production_tasks for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.inventory_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.production_orders enable row level security;
alter table public.production_tasks enable row level security;
alter table public.attachments enable row level security;

create policy "profiles_read_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "staff_all_customers" on public.customers for all to authenticated using (true) with check (true);
create policy "staff_all_quotes" on public.quotes for all to authenticated using (true) with check (true);
create policy "staff_all_quote_items" on public.quote_items for all to authenticated using (true) with check (true);
create policy "staff_all_inventory" on public.inventory_items for all to authenticated using (true) with check (true);
create policy "staff_all_stock_movements" on public.stock_movements for all to authenticated using (true) with check (true);
create policy "staff_all_production_orders" on public.production_orders for all to authenticated using (true) with check (true);
create policy "staff_all_production_tasks" on public.production_tasks for all to authenticated using (true) with check (true);
create policy "staff_all_attachments" on public.attachments for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit)
values ('artes-clientes', 'artes-clientes', false, 52428800)
on conflict (id) do nothing;

create policy "staff_read_artes" on storage.objects for select to authenticated using (bucket_id = 'artes-clientes');
create policy "staff_upload_artes" on storage.objects for insert to authenticated with check (bucket_id = 'artes-clientes');
create policy "staff_update_artes" on storage.objects for update to authenticated using (bucket_id = 'artes-clientes') with check (bucket_id = 'artes-clientes');
create policy "staff_delete_artes" on storage.objects for delete to authenticated using (bucket_id = 'artes-clientes');

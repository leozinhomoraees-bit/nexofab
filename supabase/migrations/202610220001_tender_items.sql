create table if not exists public.tender_items (
  id uuid primary key default gen_random_uuid(),
  code text,
  category text,
  description text not null,
  specification text,
  unit text not null default 'un',
  reference_cost numeric(14,4) not null default 0 check (reference_cost >= 0),
  margin_percent numeric(7,3) not null default 30 check (margin_percent >= 0 and margin_percent < 95),
  tax_percent numeric(7,3) not null default 0 check (tax_percent >= 0 and tax_percent < 95),
  reference_price numeric(14,4) not null default 0 check (reference_price >= 0),
  source_note text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (margin_percent + tax_percent < 95)
);

create unique index if not exists tender_items_code_unique on public.tender_items (lower(code)) where code is not null and code <> '';
create index if not exists tender_items_search_idx on public.tender_items (active, category, description);
drop trigger if exists tender_items_updated_at on public.tender_items;
create trigger tender_items_updated_at before update on public.tender_items for each row execute function public.set_updated_at();

alter table public.tender_items enable row level security;
grant select, insert, update, delete on table public.tender_items to authenticated;

drop policy if exists "management_read_tender_items" on public.tender_items;
create policy "management_read_tender_items" on public.tender_items for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'financeiro']));
drop policy if exists "commercial_manage_tender_items" on public.tender_items;
create policy "commercial_manage_tender_items" on public.tender_items for all to authenticated
  using (public.has_management_role(array['admin', 'comercial']))
  with check (public.has_management_role(array['admin', 'comercial']));

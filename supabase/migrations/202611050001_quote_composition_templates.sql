create table if not exists public.quote_composition_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  description text,
  category text not null default 'personalizado',
  item_payload jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists quote_composition_templates_name_unique
  on public.quote_composition_templates (lower(name)) where active;
create index if not exists quote_composition_templates_category_idx
  on public.quote_composition_templates (category, name) where active;

drop trigger if exists quote_composition_templates_updated_at on public.quote_composition_templates;
create trigger quote_composition_templates_updated_at before update on public.quote_composition_templates
  for each row execute function public.set_updated_at();

alter table public.quote_composition_templates enable row level security;
grant select, insert, update, delete on table public.quote_composition_templates to authenticated;

drop policy if exists "management_read_quote_composition_templates" on public.quote_composition_templates;
create policy "management_read_quote_composition_templates" on public.quote_composition_templates
  for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'financeiro', 'producao', 'estoque']));

drop policy if exists "commercial_manage_quote_composition_templates" on public.quote_composition_templates;
create policy "commercial_manage_quote_composition_templates" on public.quote_composition_templates
  for all to authenticated
  using (public.has_management_role(array['admin', 'comercial']))
  with check (public.has_management_role(array['admin', 'comercial']));

comment on table public.quote_composition_templates is
  'Modelos reutilizáveis de itens e composições técnicas do orçamento.';

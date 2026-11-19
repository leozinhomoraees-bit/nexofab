-- NexoFab multiempresa: aplique somente em um projeto Supabase novo e vazio.
-- Esta migration falha de propósito se detectar registros operacionais sem tenant.

alter table public.organization_members
  add column if not exists status text not null default 'active'
    check (status in ('invited', 'active', 'suspended')),
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles
  add column if not exists active_organization_id uuid references public.organizations(id) on delete set null;

create index if not exists profiles_active_organization_idx
  on public.profiles(active_organization_id);
create index if not exists organization_members_active_user_idx
  on public.organization_members(user_id, organization_id)
  where status = 'active';

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select profile.active_organization_id
  from public.profiles profile
  where profile.id = auth.uid()
    and profile.active
    and exists (
      select 1
      from public.organization_members member
      where member.organization_id = profile.active_organization_id
        and member.user_id = auth.uid()
        and member.status = 'active'
    );
$$;

create or replace function public.has_organization_role(p_organization_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = p_organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and member.role = any(p_roles)
  );
$$;

-- Compatibilidade temporária com as RPCs existentes, agora vinculada ao tenant ativo.
create or replace function public.has_management_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = public.current_organization_id()
      and member.user_id = auth.uid()
      and member.status = 'active'
      and (
        member.role = any(allowed_roles)
        or (member.role = 'owner' and 'admin' = any(allowed_roles))
      )
  );
$$;

revoke all on function public.current_organization_id() from public;
revoke all on function public.has_organization_role(uuid, text[]) from public;
revoke all on function public.has_management_role(text[]) from public;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.has_organization_role(uuid, text[]) to authenticated;
grant execute on function public.has_management_role(text[]) to authenticated;

do $$
declare
  table_name text;
  has_unscoped_rows boolean;
  tenant_tables text[] := array[
    'financial_months', 'pricing_materials', 'pricing_machines',
    'pricing_machine_consumables', 'pricing_settings', 'pricing_products',
    'quote_payments', 'pricing_fixed_costs', 'pricing_product_components',
    'customers', 'quotes', 'quote_items', 'inventory_items', 'stock_movements',
    'production_orders', 'production_tasks', 'attachments', 'proposal_shares',
    'management_notifications', 'suppliers', 'expense_categories', 'cost_centers',
    'payables', 'payable_installments', 'receivable_installments',
    'financial_documents', 'quote_approval_versions', 'tender_items',
    'payment_receipts', 'quote_composition_templates',
    'production_material_reservations', 'production_actual_entries',
    'production_artwork_approvals', 'pricing_cost_centers'
  ];
begin
  foreach table_name in array tenant_tables loop
    execute format(
      'alter table public.%I add column if not exists organization_id uuid references public.organizations(id) on delete restrict',
      table_name
    );

    execute format(
      'select exists (select 1 from public.%I where organization_id is null)',
      table_name
    ) into has_unscoped_rows;

    if has_unscoped_rows then
      raise exception 'NexoFab exige banco vazio: a tabela % possui registros sem organização', table_name;
    end if;

    execute format('alter table public.%I alter column organization_id set not null', table_name);
    execute format(
      'create index if not exists %I on public.%I (organization_id)',
      table_name || '_organization_idx', table_name
    );
  end loop;
end;
$$;

-- Unicidades configuráveis passam a valer dentro da organização.
alter table public.financial_months drop constraint if exists financial_months_competence_month_key;
create unique index if not exists financial_months_org_competence_unique
  on public.financial_months(organization_id, competence_month);

alter table public.inventory_items drop constraint if exists inventory_items_sku_key;
create unique index if not exists inventory_items_org_sku_unique
  on public.inventory_items(organization_id, sku) where sku is not null;

alter table public.pricing_materials drop constraint if exists pricing_materials_sku_key;
create unique index if not exists pricing_materials_org_sku_unique
  on public.pricing_materials(organization_id, sku) where sku is not null;

alter table public.pricing_products drop constraint if exists pricing_products_code_key;
create unique index if not exists pricing_products_org_code_unique
  on public.pricing_products(organization_id, code);

alter table public.pricing_settings drop constraint if exists pricing_settings_pkey;
alter table public.pricing_settings add primary key (organization_id, id);

alter table public.expense_categories drop constraint if exists expense_categories_name_key;
create unique index if not exists expense_categories_org_name_unique
  on public.expense_categories(organization_id, lower(name));

alter table public.cost_centers drop constraint if exists cost_centers_name_key;
alter table public.cost_centers drop constraint if exists cost_centers_code_key;
create unique index if not exists cost_centers_org_name_unique
  on public.cost_centers(organization_id, lower(name));
create unique index if not exists cost_centers_org_code_unique
  on public.cost_centers(organization_id, code) where code is not null;

drop index if exists public.suppliers_document_unique;
create unique index suppliers_org_document_unique
  on public.suppliers(organization_id, document) where document is not null and document <> '';

drop index if exists public.tender_items_code_unique;
create unique index tender_items_org_code_unique
  on public.tender_items(organization_id, lower(code)) where code is not null and code <> '';

drop index if exists public.quote_composition_templates_name_unique;
create unique index quote_composition_templates_org_name_unique
  on public.quote_composition_templates(organization_id, lower(name)) where active = true;

alter table public.pricing_cost_centers drop constraint if exists pricing_cost_centers_code_key;
create unique index if not exists pricing_cost_centers_org_code_unique
  on public.pricing_cost_centers(organization_id, code);
drop index if exists public.pricing_cost_centers_one_default_idx;
create unique index pricing_cost_centers_org_one_default_idx
  on public.pricing_cost_centers(organization_id) where is_default = true and active = true;

create or replace function public.set_row_organization()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  active_organization uuid := public.current_organization_id();
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'Não é permitido mover registros entre organizações';
    end if;
    return new;
  end if;
  if new.organization_id is null then
    new.organization_id := active_organization;
  end if;
  if new.organization_id is null or new.organization_id is distinct from active_organization then
    raise exception 'Organização ativa inválida';
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_assign_organization on public.quotes;

do $$
declare
  table_name text;
  policy_name text;
  tenant_tables text[] := array[
    'financial_months', 'pricing_materials', 'pricing_machines',
    'pricing_machine_consumables', 'pricing_settings', 'pricing_products',
    'quote_payments', 'pricing_fixed_costs', 'pricing_product_components',
    'customers', 'quotes', 'quote_items', 'inventory_items', 'stock_movements',
    'production_orders', 'production_tasks', 'attachments', 'proposal_shares',
    'management_notifications', 'suppliers', 'expense_categories', 'cost_centers',
    'payables', 'payable_installments', 'receivable_installments',
    'financial_documents', 'quote_approval_versions', 'tender_items',
    'payment_receipts', 'quote_composition_templates',
    'production_material_reservations', 'production_actual_entries',
    'production_artwork_approvals', 'pricing_cost_centers'
  ];
begin
  foreach table_name in array tenant_tables loop
    for policy_name in
      select policyname from pg_policies where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    end loop;

    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = public.current_organization_id())',
      'tenant_read_' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (organization_id = public.current_organization_id() and public.has_organization_role(organization_id, array[''owner'',''admin'',''comercial'',''producao'',''estoque'',''financeiro'']))',
      'tenant_insert_' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id() and public.has_organization_role(organization_id, array[''owner'',''admin'',''comercial'',''producao'',''estoque'',''financeiro'']))',
      'tenant_update_' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (organization_id = public.current_organization_id() and public.has_organization_role(organization_id, array[''owner'',''admin'',''comercial'',''producao'',''estoque'',''financeiro'']))',
      'tenant_delete_' || table_name, table_name
    );
    execute format('drop trigger if exists set_tenant_context on public.%I', table_name);
    execute format(
      'create trigger set_tenant_context before insert or update on public.%I for each row execute function public.set_row_organization()',
      table_name
    );
  end loop;
end;
$$;

-- Acesso à organização e aos vínculos também é tenant-aware.
drop policy if exists "members_read_organization" on public.organizations;
drop policy if exists "admins_update_organization" on public.organizations;
create policy "members_read_organization" on public.organizations
for select to authenticated
using (public.has_organization_role(id, array['owner','admin','comercial','producao','estoque','financeiro']));
create policy "admins_update_organization" on public.organizations
for update to authenticated
using (public.has_organization_role(id, array['owner','admin']))
with check (public.has_organization_role(id, array['owner','admin']));

drop policy if exists "members_read_membership" on public.organization_members;
create policy "members_read_membership" on public.organization_members
for select to authenticated
using (organization_id = public.current_organization_id());
create policy "admins_manage_membership" on public.organization_members
for all to authenticated
using (public.has_organization_role(organization_id, array['owner','admin']))
with check (public.has_organization_role(organization_id, array['owner','admin']));

create or replace function public.create_organization(p_trade_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  organization_id uuid;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  if length(trim(p_trade_name)) < 2 or length(trim(p_trade_name)) > 120 then
    raise exception 'Nome da empresa inválido';
  end if;

  insert into public.organizations(trade_name)
  values (trim(p_trade_name))
  returning id into organization_id;

  insert into public.organization_members(organization_id, user_id, role, status)
  values (organization_id, auth.uid(), 'owner', 'active');

  update public.profiles
  set active_organization_id = organization_id, updated_at = now()
  where id = auth.uid();

  return organization_id;
end;
$$;

create or replace function public.set_active_organization(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id
      and user_id = auth.uid()
      and status = 'active'
  ) then
    raise exception 'Usuário não pertence a esta organização';
  end if;
  update public.profiles
  set active_organization_id = p_organization_id, updated_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.create_organization(text) from public;
revoke all on function public.set_active_organization(uuid) from public;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.set_active_organization(uuid) to authenticated;

-- Planos e assinaturas são metadados da plataforma; nenhum plano comercial é pré-cadastrado.
create table public.plans (
  id text primary key,
  name text not null,
  description text,
  monthly_price_cents integer not null default 0 check (monthly_price_cents >= 0),
  entitlements jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan_id text references public.plans(id) on delete restrict,
  status text not null default 'trialing'
    check (status in ('trialing','active','past_due','canceled','suspended')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usage_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric text not null,
  period_start date not null,
  quantity bigint not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, metric, period_start)
);

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

alter table public.plans enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.usage_counters enable row level security;
alter table public.billing_events enable row level security;

create policy "authenticated_read_plans" on public.plans
for select to authenticated using (active);
create policy "members_read_subscription" on public.organization_subscriptions
for select to authenticated using (organization_id = public.current_organization_id());
create policy "members_read_usage" on public.usage_counters
for select to authenticated using (organization_id = public.current_organization_id());

grant select on public.plans, public.organization_subscriptions, public.usage_counters to authenticated;

-- Storage: todo caminho gravado inicia pelo UUID da organização.
do $$
declare policy_name text;
begin
  for policy_name in
    select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy if exists %I on storage.objects', policy_name);
  end loop;
end;
$$;

create policy "tenant_storage_read" on storage.objects
for select to authenticated
using (
  bucket_id in ('artes-clientes','financeiro-documentos','artes-aprovacao','company-assets')
  and split_part(name, '/', 1) = public.current_organization_id()::text
);
create policy "tenant_storage_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id in ('artes-clientes','financeiro-documentos','artes-aprovacao','company-assets')
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner','admin','comercial','producao','estoque','financeiro'])
);
create policy "tenant_storage_update" on storage.objects
for update to authenticated
using (split_part(name, '/', 1) = public.current_organization_id()::text)
with check (split_part(name, '/', 1) = public.current_organization_id()::text);
create policy "tenant_storage_delete" on storage.objects
for delete to authenticated
using (
  split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner','admin','comercial','producao','estoque','financeiro'])
);
create policy "public_company_assets_read" on storage.objects
for select to public using (bucket_id = 'company-assets');

-- Recibos públicos recebem somente a identidade da organização emissora.
create or replace function public.get_public_payment_receipt(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'receipt_id', receipt.id,
    'issued_at', receipt.issued_at,
    'amount', payment.amount,
    'payment_type', payment.payment_type,
    'payment_method', payment.payment_method,
    'received_on', payment.received_on,
    'notes', payment.notes,
    'quote_number', quote.number,
    'customer_name', quote.customer_name,
    'company', quote.company,
    'service', quote.service,
    'customer_document', customer.document,
    'issuer', jsonb_build_object(
      'trade_name', organization.trade_name,
      'legal_name', organization.legal_name,
      'logo_url', organization.logo_url,
      'proposal_footer', organization.proposal_footer,
      'address_city', organization.address_city,
      'address_state', organization.address_state
    )
  )
  from public.payment_receipts receipt
  join public.quote_payments payment on payment.id = receipt.payment_id
  join public.quotes quote on quote.id = payment.quote_id
  join public.organizations organization on organization.id = quote.organization_id
  left join public.customers customer on customer.id = quote.customer_id
  where receipt.public_token = p_token and receipt.revoked_at is null
  limit 1;
$$;

revoke all on function public.get_public_payment_receipt(uuid) from public;
grant execute on function public.get_public_payment_receipt(uuid) to anon, authenticated;

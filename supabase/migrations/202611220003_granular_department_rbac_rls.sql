-- Item 3: RBAC granular por departamento diretamente nas políticas RLS e no Storage.
-- Garante defesa em profundidade: mesmo chamadas diretas via PostgREST/Storage com JWT
-- de um usuário autenticado ficam restritas ao tenant ativo E ao papel do departamento.

do $$
declare
  v_all text[] := array['owner', 'admin', 'comercial', 'producao', 'estoque', 'financeiro'];
  v_admin text[] := array['owner', 'admin'];
  v_finance text[] := array['owner', 'admin', 'financeiro'];
  v_fin_com text[] := array['owner', 'admin', 'financeiro', 'comercial'];
  v_com text[] := array['owner', 'admin', 'comercial'];
  v_prod text[] := array['owner', 'admin', 'producao'];
  v_stock text[] := array['owner', 'admin', 'estoque'];
  v_stock_prod text[] := array['owner', 'admin', 'estoque', 'producao'];
  v_prod_fin text[] := array['owner', 'admin', 'producao', 'financeiro'];
  v_prod_com text[] := array['owner', 'admin', 'producao', 'comercial'];

  rec record;
  v_policy text;
begin
  for rec in
    select * from (
      values
        -- 1. Módulo Financeiro (restrito a owner, admin e financeiro)
        ('financial_months',              v_finance,  v_finance,    v_finance,    v_finance),
        ('payables',                      v_finance,  v_finance,    v_finance,    v_finance),
        ('payable_installments',          v_finance,  v_finance,    v_finance,    v_finance),
        ('financial_documents',           v_finance,  v_finance,    v_finance,    v_finance),
        ('expense_categories',            v_finance,  v_finance,    v_finance,    v_finance),
        ('cost_centers',                  v_finance,  v_finance,    v_finance,    v_finance),
        ('payment_receipts',              v_finance,  v_finance,    v_finance,    v_admin),
        ('quote_payments',                v_finance,  v_finance,    v_finance,    v_admin),
        ('receivable_installments',       v_fin_com,  v_finance,    v_finance,    v_admin),
        ('suppliers',                     v_all,      v_finance,    v_finance,    v_finance),

        -- 2. Precificação e Custos Fixos (alinhado 1-a-1 com cada departamento)
        ('pricing_settings',              v_all,      v_admin,      v_admin,      v_admin),
        ('pricing_fixed_costs',           v_fin_com,  v_admin,      v_admin,      v_admin),
        ('pricing_cost_centers',          v_all,      v_admin,      v_admin,      v_admin),
        ('pricing_materials',             v_all,      v_stock,      v_stock,      v_stock),
        ('pricing_machines',              v_all,      v_prod,       v_prod,       v_prod),
        ('pricing_machine_consumables',   v_all,      v_prod,       v_prod,       v_prod),
        ('pricing_products',              v_all,      v_com,        v_com,        v_com),
        ('pricing_product_components',    v_all,      v_com,        v_com,        v_com),

        -- 3. Módulo Comercial e Propostas
        ('customers',                     v_all,      v_com,        v_com,        v_admin),
        ('quotes',                        v_all,      v_fin_com,    v_fin_com,    v_com),
        ('quote_items',                   v_all,      v_fin_com,    v_fin_com,    v_com),
        ('proposal_shares',               v_fin_com,  v_fin_com,    v_fin_com,    v_com),
        ('quote_approval_versions',       v_fin_com,  v_admin,      v_admin,      v_admin),
        ('tender_items',                  v_fin_com,  v_com,        v_com,        v_com),
        ('quote_composition_templates',   v_all,      v_com,        v_com,        v_com),

        -- 4. Produção, Artes e Estoque
        ('inventory_items',               v_all,      v_stock_prod, v_stock_prod, v_stock),
        ('stock_movements',               v_all,      v_stock_prod, v_stock_prod, v_admin),
        ('production_orders',             v_all,      v_prod,       v_prod,       v_admin),
        ('production_tasks',              v_all,      v_prod,       v_prod,       v_prod),
        ('production_material_reservations', v_all,   v_stock_prod, v_stock_prod, v_admin),
        ('production_actual_entries',     v_prod_fin, v_prod_fin,   v_prod_fin,   v_admin),
        ('production_artwork_approvals',  v_all,      v_prod_com,   v_prod_com,   v_admin),

        -- 5. Utilitários operacionais
        ('attachments',                   v_all,      v_all,        v_all,        v_admin),
        ('management_notifications',      v_all,      v_admin,      v_all,        v_admin)
    ) as t(table_name, read_roles, insert_roles, update_roles, delete_roles)
  loop
    for v_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = rec.table_name
    loop
      execute format('drop policy if exists %I on public.%I', v_policy, rec.table_name);
    end loop;

    execute format('alter table public.%I enable row level security', rec.table_name);
    execute format('alter table public.%I force row level security', rec.table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = public.current_organization_id() and public.has_organization_role(organization_id, %L::text[]))',
      'rbac_read_' || rec.table_name, rec.table_name, rec.read_roles
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (organization_id = public.current_organization_id() and public.has_organization_role(organization_id, %L::text[]))',
      'rbac_insert_' || rec.table_name, rec.table_name, rec.insert_roles
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (organization_id = public.current_organization_id() and public.has_organization_role(organization_id, %L::text[])) with check (organization_id = public.current_organization_id() and public.has_organization_role(organization_id, %L::text[]))',
      'rbac_update_' || rec.table_name, rec.table_name, rec.update_roles, rec.update_roles
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (organization_id = public.current_organization_id() and public.has_organization_role(organization_id, %L::text[]))',
      'rbac_delete_' || rec.table_name, rec.table_name, rec.delete_roles
    );
  end loop;
end;
$$;

-- ============================================================================
-- Storage: RBAC granular por bucket + prefixo <current_organization_id()>/...
-- ============================================================================

drop policy if exists "tenant_storage_read" on storage.objects;
drop policy if exists "tenant_storage_insert" on storage.objects;
drop policy if exists "tenant_storage_update" on storage.objects;
drop policy if exists "tenant_storage_delete" on storage.objects;

-- 1. Documentos financeiros (NF-e XML, boletos, comprovantes): somente owner/admin/financeiro
drop policy if exists "rbac_storage_finance_read" on storage.objects;
create policy "rbac_storage_finance_read" on storage.objects
for select to authenticated
using (
  bucket_id = 'financeiro-documentos'
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner', 'admin', 'financeiro'])
);

drop policy if exists "rbac_storage_finance_write" on storage.objects;
create policy "rbac_storage_finance_write" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'financeiro-documentos'
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner', 'admin', 'financeiro'])
);

drop policy if exists "rbac_storage_finance_update" on storage.objects;
create policy "rbac_storage_finance_update" on storage.objects
for update to authenticated
using (
  bucket_id = 'financeiro-documentos'
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner', 'admin', 'financeiro'])
)
with check (
  bucket_id = 'financeiro-documentos'
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner', 'admin', 'financeiro'])
);

drop policy if exists "rbac_storage_finance_delete" on storage.objects;
create policy "rbac_storage_finance_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'financeiro-documentos'
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner', 'admin', 'financeiro'])
);

-- 2. Identidade da empresa (logo): leitura pública mantida (public_company_assets_read); escrita somente owner/admin
drop policy if exists "rbac_storage_company_write" on storage.objects;
create policy "rbac_storage_company_write" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'company-assets'
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner', 'admin'])
);

drop policy if exists "rbac_storage_company_update" on storage.objects;
create policy "rbac_storage_company_update" on storage.objects
for update to authenticated
using (
  bucket_id = 'company-assets'
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner', 'admin'])
)
with check (
  bucket_id = 'company-assets'
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner', 'admin'])
);

drop policy if exists "rbac_storage_company_delete" on storage.objects;
create policy "rbac_storage_company_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'company-assets'
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner', 'admin'])
);

-- 3. Artes de aprovação e artes de clientes: leitura para membros ativos da empresa; escrita para owner/admin/producao/comercial
drop policy if exists "rbac_storage_artworks_read" on storage.objects;
create policy "rbac_storage_artworks_read" on storage.objects
for select to authenticated
using (
  bucket_id in ('artes-clientes', 'artes-aprovacao')
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner', 'admin', 'comercial', 'producao', 'estoque', 'financeiro'])
);

drop policy if exists "rbac_storage_artworks_write" on storage.objects;
create policy "rbac_storage_artworks_write" on storage.objects
for insert to authenticated
with check (
  bucket_id in ('artes-clientes', 'artes-aprovacao')
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner', 'admin', 'producao', 'comercial'])
);

drop policy if exists "rbac_storage_artworks_update" on storage.objects;
create policy "rbac_storage_artworks_update" on storage.objects
for update to authenticated
using (
  bucket_id in ('artes-clientes', 'artes-aprovacao')
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner', 'admin', 'producao', 'comercial'])
)
with check (
  bucket_id in ('artes-clientes', 'artes-aprovacao')
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner', 'admin', 'producao', 'comercial'])
);

drop policy if exists "rbac_storage_artworks_delete" on storage.objects;
create policy "rbac_storage_artworks_delete" on storage.objects
for delete to authenticated
using (
  bucket_id in ('artes-clientes', 'artes-aprovacao')
  and split_part(name, '/', 1) = public.current_organization_id()::text
  and public.has_organization_role(public.current_organization_id(), array['owner', 'admin', 'producao', 'comercial'])
);

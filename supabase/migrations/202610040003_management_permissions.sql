create or replace function public.has_management_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and active
      and role = any(allowed_roles)
  );
$$;

revoke all on function public.has_management_role(text[]) from public;
grant execute on function public.has_management_role(text[]) to authenticated;

grant select on table
  public.customers,
  public.quotes,
  public.quote_items,
  public.inventory_items,
  public.stock_movements,
  public.production_orders,
  public.production_tasks,
  public.attachments,
  public.financial_months,
  public.quote_payments
to authenticated;

grant insert, update, delete on table
  public.customers,
  public.quotes,
  public.quote_items,
  public.inventory_items,
  public.stock_movements,
  public.production_orders,
  public.production_tasks,
  public.attachments
to authenticated;

grant insert, update on table public.financial_months to authenticated;
grant usage, select on all sequences in schema public to authenticated;

drop policy if exists "staff_all_customers" on public.customers;
drop policy if exists "staff_all_quotes" on public.quotes;
drop policy if exists "staff_all_quote_items" on public.quote_items;
drop policy if exists "staff_all_inventory" on public.inventory_items;
drop policy if exists "staff_all_stock_movements" on public.stock_movements;
drop policy if exists "staff_all_production_orders" on public.production_orders;
drop policy if exists "staff_all_production_tasks" on public.production_tasks;
drop policy if exists "staff_all_attachments" on public.attachments;

create policy "management_read_customers"
  on public.customers for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']));
create policy "commercial_manage_customers"
  on public.customers for all to authenticated
  using (public.has_management_role(array['admin', 'comercial']))
  with check (public.has_management_role(array['admin', 'comercial']));

create policy "management_read_quotes"
  on public.quotes for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']));
create policy "commercial_manage_quotes"
  on public.quotes for all to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'financeiro']))
  with check (public.has_management_role(array['admin', 'comercial', 'financeiro']));

create policy "management_read_quote_items"
  on public.quote_items for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']));
create policy "commercial_manage_quote_items"
  on public.quote_items for all to authenticated
  using (public.has_management_role(array['admin', 'comercial']))
  with check (public.has_management_role(array['admin', 'comercial']));

create policy "management_read_inventory"
  on public.inventory_items for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']));
create policy "inventory_team_manage_items"
  on public.inventory_items for all to authenticated
  using (public.has_management_role(array['admin', 'estoque']))
  with check (public.has_management_role(array['admin', 'estoque']));

create policy "management_read_stock_movements"
  on public.stock_movements for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']));
create policy "inventory_team_manage_movements"
  on public.stock_movements for all to authenticated
  using (public.has_management_role(array['admin', 'estoque']))
  with check (public.has_management_role(array['admin', 'estoque']));

create policy "management_read_production_orders"
  on public.production_orders for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']));
create policy "production_team_manage_orders"
  on public.production_orders for all to authenticated
  using (public.has_management_role(array['admin', 'producao']))
  with check (public.has_management_role(array['admin', 'producao']));

create policy "management_read_production_tasks"
  on public.production_tasks for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']));
create policy "production_team_manage_tasks"
  on public.production_tasks for all to authenticated
  using (public.has_management_role(array['admin', 'producao']))
  with check (public.has_management_role(array['admin', 'producao']));

create policy "management_read_attachments"
  on public.attachments for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']));
create policy "management_manage_attachments"
  on public.attachments for all to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']))
  with check (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']));

drop policy if exists "staff_read_payments" on public.quote_payments;
create policy "management_read_payments"
  on public.quote_payments for select to authenticated
  using (public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro']));

drop policy if exists "staff_read_artes" on storage.objects;
drop policy if exists "staff_upload_artes" on storage.objects;
drop policy if exists "staff_update_artes" on storage.objects;
drop policy if exists "staff_delete_artes" on storage.objects;

create policy "management_read_artes"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'artes-clientes'
    and public.has_management_role(array['admin', 'comercial', 'producao', 'estoque', 'financeiro'])
  );
create policy "management_upload_artes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'artes-clientes'
    and public.has_management_role(array['admin', 'comercial', 'producao'])
  );
create policy "management_update_artes"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'artes-clientes'
    and public.has_management_role(array['admin', 'comercial', 'producao'])
  )
  with check (
    bucket_id = 'artes-clientes'
    and public.has_management_role(array['admin', 'comercial', 'producao'])
  );
create policy "management_delete_artes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'artes-clientes'
    and public.has_management_role(array['admin', 'comercial', 'producao'])
  );

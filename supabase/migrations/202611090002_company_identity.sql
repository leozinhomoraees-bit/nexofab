create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  trade_name text not null,
  legal_name text,
  document text,
  state_registration text,
  email text,
  phone text,
  whatsapp text,
  website text,
  address_street text,
  address_number text,
  address_complement text,
  address_district text,
  address_city text,
  address_state text,
  address_zip_code text,
  logo_url text,
  logo_storage_path text,
  proposal_footer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

alter table public.quotes add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
create index if not exists quotes_organization_id_idx on public.quotes(organization_id);
create index if not exists organization_members_user_idx on public.organization_members(user_id);

create or replace function public.assign_quote_organization()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.organization_id is null then
    select om.organization_id into new.organization_id
    from public.organization_members om
    where om.user_id = coalesce(new.created_by, auth.uid())
    order by om.created_at
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_assign_organization on public.quotes;
create trigger quotes_assign_organization before insert on public.quotes
for each row execute function public.assign_quote_organization();

drop trigger if exists organizations_updated_at on public.organizations;
create trigger organizations_updated_at before update on public.organizations
for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

grant usage on schema public to authenticated;
grant select, update on table public.organizations to authenticated;
grant select on table public.organization_members to authenticated;

drop policy if exists "members_read_organization" on public.organizations;
create policy "members_read_organization" on public.organizations for select to authenticated
using (exists (select 1 from public.organization_members om where om.organization_id = id and om.user_id = auth.uid()));

drop policy if exists "admins_update_organization" on public.organizations;
create policy "admins_update_organization" on public.organizations for update to authenticated
using (
  exists (select 1 from public.organization_members om where om.organization_id = id and om.user_id = auth.uid())
  and public.has_management_role(array['admin'])
)
with check (
  exists (select 1 from public.organization_members om where om.organization_id = id and om.user_id = auth.uid())
  and public.has_management_role(array['admin'])
);

drop policy if exists "members_read_membership" on public.organization_members;
create policy "members_read_membership" on public.organization_members for select to authenticated
using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-assets', 'company-assets', true, 3145728, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "company_assets_public_read" on storage.objects;
create policy "company_assets_public_read" on storage.objects for select to public
using (bucket_id = 'company-assets');

drop policy if exists "company_assets_admin_insert" on storage.objects;
create policy "company_assets_admin_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'company-assets' and public.has_management_role(array['admin']));

drop policy if exists "company_assets_admin_update" on storage.objects;
create policy "company_assets_admin_update" on storage.objects for update to authenticated
using (bucket_id = 'company-assets' and public.has_management_role(array['admin']))
with check (bucket_id = 'company-assets' and public.has_management_role(array['admin']));

drop policy if exists "company_assets_admin_delete" on storage.objects;
create policy "company_assets_admin_delete" on storage.objects for delete to authenticated
using (bucket_id = 'company-assets' and public.has_management_role(array['admin']));

create or replace function public.get_public_proposal(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_quote_id uuid;
  v_result jsonb;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;
  select quote_id into v_quote_id from public.proposal_shares
  where token_hash = encode(digest(p_token, 'sha256'), 'hex') and revoked_at is null;
  if v_quote_id is null then return null; end if;

  select jsonb_build_object(
    'id', q.id, 'number', q.number, 'customer_name', q.customer_name, 'company', q.company,
    'service', q.service, 'details', q.details, 'status', q.status, 'subtotal', q.subtotal,
    'discount', q.discount, 'estimated_value', q.estimated_value, 'valid_until', q.valid_until,
    'payment_terms', q.payment_terms, 'delivery_days', q.delivery_days,
    'installation_included', q.installation_included, 'freight', q.freight, 'created_at', q.created_at,
    'issuer', jsonb_build_object(
      'trade_name', o.trade_name, 'legal_name', o.legal_name, 'document', o.document,
      'state_registration', o.state_registration, 'email', o.email, 'phone', o.phone,
      'whatsapp', o.whatsapp, 'website', o.website, 'logo_url', o.logo_url,
      'proposal_footer', o.proposal_footer, 'address_street', o.address_street,
      'address_number', o.address_number, 'address_complement', o.address_complement,
      'address_district', o.address_district, 'address_city', o.address_city,
      'address_state', o.address_state, 'address_zip_code', o.address_zip_code
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'description', i.description, 'service_type', i.service_type,
        'material', i.material, 'width_mm', i.width_mm, 'height_mm', i.height_mm,
        'quantity', i.quantity, 'unit', i.unit, 'unit_price', i.unit_price,
        'total', i.total, 'sort_order', i.sort_order, 'option_group', i.option_group,
        'selected_by_customer', i.selected_by_customer
      ) order by i.sort_order)
      from public.quote_items i where i.quote_id = q.id
    ), '[]'::jsonb)
  ) into v_result
  from public.quotes q
  left join public.organizations o on o.id = q.organization_id
  where q.id = v_quote_id;
  return v_result;
end;
$$;

revoke all on function public.get_public_proposal(text) from public;
grant execute on function public.get_public_proposal(text) to anon, authenticated;

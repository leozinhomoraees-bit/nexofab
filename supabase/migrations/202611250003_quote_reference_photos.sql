-- Fotos de referencia / mockups anexados ao orcamento (exibidos na proposta publica e na OS)
create table if not exists public.quote_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  caption text,
  file_url text not null,
  storage_path text not null,
  content_type text not null,
  show_on_proposal boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists quote_attachments_quote_idx
  on public.quote_attachments (organization_id, quote_id, sort_order, created_at);

drop trigger if exists set_tenant_context on public.quote_attachments;
create trigger set_tenant_context
  before insert or update on public.quote_attachments
  for each row execute function public.set_row_organization();

alter table public.quote_attachments enable row level security;
alter table public.quote_attachments force row level security;

revoke all on table public.quote_attachments from public, anon, authenticated;
grant select, insert, update, delete on table public.quote_attachments to authenticated;

drop policy if exists "rbac_read_quote_attachments" on public.quote_attachments;
create policy "rbac_read_quote_attachments" on public.quote_attachments
for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_organization_role(organization_id, array['owner', 'admin', 'comercial', 'producao', 'financeiro', 'estoque'])
);

drop policy if exists "rbac_insert_quote_attachments" on public.quote_attachments;
create policy "rbac_insert_quote_attachments" on public.quote_attachments
for insert to authenticated
with check (
  organization_id = public.current_organization_id()
  and public.has_organization_role(organization_id, array['owner', 'admin', 'comercial', 'producao'])
);

drop policy if exists "rbac_update_quote_attachments" on public.quote_attachments;
create policy "rbac_update_quote_attachments" on public.quote_attachments
for update to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_organization_role(organization_id, array['owner', 'admin', 'comercial', 'producao'])
)
with check (
  organization_id = public.current_organization_id()
  and public.has_organization_role(organization_id, array['owner', 'admin', 'comercial', 'producao'])
);

drop policy if exists "rbac_delete_quote_attachments" on public.quote_attachments;
create policy "rbac_delete_quote_attachments" on public.quote_attachments
for delete to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_organization_role(organization_id, array['owner', 'admin', 'comercial', 'producao'])
);

-- Atualiza get_public_proposal para incluir fotos de referencia marcadas com show_on_proposal = true
create or replace function public.get_public_proposal(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_quote_id uuid;
  v_org_id uuid;
  v_result jsonb;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;

  select quote_id, organization_id into v_quote_id, v_org_id
  from public.proposal_shares
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and revoked_at is null;
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
      from public.quote_items i
      where i.quote_id = q.id and i.organization_id = q.organization_id
    ), '[]'::jsonb),
    'attachments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'caption', a.caption, 'file_url', a.file_url, 'sort_order', a.sort_order
      ) order by a.sort_order, a.created_at)
      from public.quote_attachments a
      where a.quote_id = q.id
        and a.organization_id = q.organization_id
        and a.show_on_proposal = true
    ), '[]'::jsonb)
  ) into v_result
  from public.quotes q
  join public.organizations o on o.id = q.organization_id
  where q.id = v_quote_id and q.organization_id = v_org_id;
  return v_result;
end;
$$;

revoke all on function public.get_public_proposal(text) from public;
grant execute on function public.get_public_proposal(text) to anon, authenticated;

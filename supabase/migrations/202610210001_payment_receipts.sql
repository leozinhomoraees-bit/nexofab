create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.quote_payments(id) on delete restrict,
  public_token uuid not null unique default gen_random_uuid(),
  issued_by uuid references public.profiles(id) on delete set null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists payment_receipts_token_idx on public.payment_receipts (public_token) where revoked_at is null;
alter table public.payment_receipts enable row level security;
grant select, insert, update on table public.payment_receipts to authenticated;

drop policy if exists "finance_read_payment_receipts" on public.payment_receipts;
create policy "finance_read_payment_receipts" on public.payment_receipts for select to authenticated
  using (public.has_management_role(array['admin', 'financeiro', 'comercial']));
drop policy if exists "finance_manage_payment_receipts" on public.payment_receipts;
create policy "finance_manage_payment_receipts" on public.payment_receipts for all to authenticated
  using (public.has_management_role(array['admin', 'financeiro']))
  with check (public.has_management_role(array['admin', 'financeiro']));

create or replace function public.get_public_payment_receipt(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'receipt_id', r.id,
    'issued_at', r.issued_at,
    'amount', p.amount,
    'payment_type', p.payment_type,
    'payment_method', p.payment_method,
    'received_on', p.received_on,
    'notes', p.notes,
    'quote_number', q.number,
    'customer_name', q.customer_name,
    'company', q.company,
    'service', q.service,
    'customer_document', c.document
  )
  from public.payment_receipts r
  join public.quote_payments p on p.id = r.payment_id
  join public.quotes q on q.id = p.quote_id
  left join public.customers c on c.id = q.customer_id
  where r.public_token = p_token and r.revoked_at is null
  limit 1;
$$;

revoke all on function public.get_public_payment_receipt(uuid) from public;
grant execute on function public.get_public_payment_receipt(uuid) to anon, authenticated;

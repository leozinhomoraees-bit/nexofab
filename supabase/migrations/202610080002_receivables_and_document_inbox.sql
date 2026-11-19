create table public.receivable_installments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete restrict,
  installment_number integer not null check (installment_number >= 0),
  due_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null default 'pix' check (payment_method in ('pix', 'dinheiro', 'cartao', 'boleto', 'transferencia', 'outro')),
  status text not null default 'pendente' check (status in ('pendente', 'agendado', 'recebido', 'cancelado')),
  scheduled_on date,
  received_on date,
  received_amount numeric(14,2) check (received_amount is null or received_amount >= 0),
  interest_amount numeric(14,2) not null default 0 check (interest_amount >= 0),
  fine_amount numeric(14,2) not null default 0 check (fine_amount >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  bank_account text,
  notes text,
  quote_payment_id uuid references public.quote_payments(id) on delete restrict,
  received_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_id, installment_number)
);

create index receivable_installments_due_idx on public.receivable_installments (due_date, status);
create index receivable_installments_quote_idx on public.receivable_installments (quote_id, installment_number);
create trigger receivable_installments_updated_at before update on public.receivable_installments for each row execute function public.set_updated_at();

create table public.financial_documents (
  id uuid primary key default gen_random_uuid(),
  original_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  content_hash text not null unique,
  document_kind text not null default 'outro' check (document_kind in ('boleto', 'nota_fiscal', 'fatura', 'outro')),
  extraction_status text not null default 'processado' check (extraction_status in ('processado', 'revisado', 'erro', 'precisa_ocr')),
  confidence numeric(5,2) not null default 0 check (confidence between 0 and 100),
  extracted_data jsonb not null default '{}'::jsonb,
  payable_id uuid references public.payables(id) on delete set null,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index financial_documents_created_idx on public.financial_documents (created_at desc);
create trigger financial_documents_updated_at before update on public.financial_documents for each row execute function public.set_updated_at();

alter table public.receivable_installments enable row level security;
alter table public.financial_documents enable row level security;

grant select, insert, update on table public.receivable_installments, public.financial_documents to authenticated;

create policy "finance_read_receivables" on public.receivable_installments for select to authenticated
  using (public.has_management_role(array['admin', 'financeiro', 'comercial']));
create policy "finance_manage_receivables" on public.receivable_installments for all to authenticated
  using (public.has_management_role(array['admin', 'financeiro']))
  with check (public.has_management_role(array['admin', 'financeiro']));

create policy "finance_read_documents" on public.financial_documents for select to authenticated
  using (public.has_management_role(array['admin', 'financeiro']));
create policy "finance_manage_documents" on public.financial_documents for all to authenticated
  using (public.has_management_role(array['admin', 'financeiro']))
  with check (public.has_management_role(array['admin', 'financeiro']));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('financeiro-documentos', 'financeiro-documentos', false, 10485760, array['application/pdf', 'application/xml', 'text/xml'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "finance_upload_documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'financeiro-documentos' and public.has_management_role(array['admin', 'financeiro']));
create policy "finance_read_stored_documents" on storage.objects for select to authenticated
  using (bucket_id = 'financeiro-documentos' and public.has_management_role(array['admin', 'financeiro']));
create policy "finance_update_stored_documents" on storage.objects for update to authenticated
  using (bucket_id = 'financeiro-documentos' and public.has_management_role(array['admin', 'financeiro']))
  with check (bucket_id = 'financeiro-documentos' and public.has_management_role(array['admin', 'financeiro']));
create policy "finance_delete_stored_documents" on storage.objects for delete to authenticated
  using (bucket_id = 'financeiro-documentos' and public.has_management_role(array['admin', 'financeiro']));

create or replace function public.close_quote_with_receivables(
  p_quote_id uuid,
  p_total_value numeric,
  p_deposit numeric,
  p_deposit_method text,
  p_received_on date,
  p_installments jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.quotes%rowtype;
  v_order_id uuid;
  v_payment_id uuid;
  v_installment jsonb;
  v_remaining numeric(14,2);
  v_scheduled_total numeric(14,2);
  v_expected_count integer;
begin
  if not public.has_management_role(array['admin', 'comercial', 'financeiro']) then raise exception 'Acesso não autorizado'; end if;
  if p_total_value <= 0 or p_deposit < 0 or p_deposit > p_total_value then raise exception 'Valores do fechamento são inválidos'; end if;
  if p_deposit_method not in ('pix', 'dinheiro', 'cartao', 'boleto', 'transferencia', 'outro') then raise exception 'Forma de pagamento inválida'; end if;
  if jsonb_typeof(p_installments) <> 'array' then raise exception 'Parcelas a receber inválidas'; end if;

  v_remaining := round(p_total_value - p_deposit, 2);
  v_expected_count := jsonb_array_length(p_installments);
  select coalesce(sum((value ->> 'amount')::numeric), 0) into v_scheduled_total from jsonb_array_elements(p_installments);
  if abs(v_remaining - v_scheduled_total) > 0.01 then raise exception 'A soma das parcelas precisa corresponder ao saldo do orçamento'; end if;
  if v_remaining > 0 and (v_expected_count < 1 or v_expected_count > 120) then raise exception 'Informe as parcelas do saldo'; end if;
  if v_remaining = 0 and v_expected_count <> 0 then raise exception 'Não deve haver parcelas quando o pagamento é integral'; end if;

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Orçamento não encontrado'; end if;
  if exists (select 1 from public.receivable_installments where quote_id = p_quote_id) then raise exception 'Este orçamento já possui contas a receber'; end if;

  update public.quotes set status = 'convertido', estimated_value = p_total_value, subtotal = p_total_value where id = p_quote_id;

  if p_deposit > 0 then
    insert into public.quote_payments (quote_id, amount, payment_type, payment_method, received_on, created_by)
    values (p_quote_id, p_deposit, case when p_deposit = p_total_value then 'integral' else 'entrada' end, p_deposit_method, p_received_on, auth.uid())
    returning id into v_payment_id;

    insert into public.receivable_installments (
      quote_id, installment_number, due_date, amount, payment_method, status,
      received_on, received_amount, quote_payment_id, received_by, notes
    ) values (
      p_quote_id, 0, p_received_on, p_deposit, p_deposit_method, 'recebido',
      p_received_on, p_deposit, v_payment_id, auth.uid(), 'Entrada recebida no fechamento'
    );
  end if;

  for v_installment in select value from jsonb_array_elements(p_installments)
  loop
    if (v_installment ->> 'payment_method') not in ('pix', 'dinheiro', 'cartao', 'boleto', 'transferencia', 'outro') then raise exception 'Forma de pagamento inválida'; end if;
    insert into public.receivable_installments (quote_id, installment_number, due_date, amount, payment_method, notes)
    values (
      p_quote_id, (v_installment ->> 'installment_number')::integer,
      (v_installment ->> 'due_date')::date, (v_installment ->> 'amount')::numeric,
      v_installment ->> 'payment_method', nullif(v_installment ->> 'notes', '')
    );
  end loop;

  select id into v_order_id from public.production_orders where quote_id = p_quote_id;
  if v_order_id is null then
    insert into public.production_orders (quote_id, customer_id, title, description, stage, created_by)
    values (p_quote_id, v_quote.customer_id, concat(v_quote.service, ' — ', v_quote.customer_name), v_quote.details, 'briefing', auth.uid())
    returning id into v_order_id;
  end if;

  return jsonb_build_object('quoteId', p_quote_id, 'paymentId', v_payment_id, 'productionOrderId', v_order_id, 'receivableCount', v_expected_count);
end;
$$;

create or replace function public.settle_receivable_installment(
  p_installment_id uuid, p_received_on date, p_received_amount numeric,
  p_interest numeric, p_fine numeric, p_discount numeric,
  p_bank_account text, p_payment_method text, p_notes text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_installment public.receivable_installments%rowtype;
  v_payment_id uuid;
  v_open_count integer;
begin
  if not public.has_management_role(array['admin', 'financeiro']) then raise exception 'Acesso financeiro não autorizado'; end if;
  if p_received_amount <= 0 or p_interest < 0 or p_fine < 0 or p_discount < 0 then raise exception 'Valores de recebimento inválidos'; end if;
  if p_payment_method not in ('pix', 'dinheiro', 'cartao', 'boleto', 'transferencia', 'outro') then raise exception 'Forma de pagamento inválida'; end if;

  select * into v_installment from public.receivable_installments where id = p_installment_id for update;
  if not found or v_installment.status not in ('pendente', 'agendado') then raise exception 'Parcela não encontrada ou já encerrada'; end if;
  select count(*) into v_open_count from public.receivable_installments where quote_id = v_installment.quote_id and status in ('pendente', 'agendado');

  insert into public.quote_payments (quote_id, amount, payment_type, payment_method, received_on, notes, created_by)
  values (v_installment.quote_id, p_received_amount, case when v_open_count = 1 then 'saldo' else 'parcela' end, p_payment_method, p_received_on, nullif(p_notes, ''), auth.uid())
  returning id into v_payment_id;

  update public.receivable_installments set
    status = 'recebido', received_on = p_received_on, received_amount = p_received_amount,
    interest_amount = p_interest, fine_amount = p_fine, discount_amount = p_discount,
    bank_account = nullif(p_bank_account, ''), payment_method = p_payment_method,
    notes = nullif(p_notes, ''), quote_payment_id = v_payment_id, received_by = auth.uid()
  where id = p_installment_id;
end;
$$;

revoke all on function public.close_quote_with_receivables(uuid, numeric, numeric, text, date, jsonb) from public;
revoke all on function public.settle_receivable_installment(uuid, date, numeric, numeric, numeric, numeric, text, text, text) from public;
grant execute on function public.close_quote_with_receivables(uuid, numeric, numeric, text, date, jsonb) to authenticated;
grant execute on function public.settle_receivable_installment(uuid, date, numeric, numeric, numeric, numeric, text, text, text) to authenticated;

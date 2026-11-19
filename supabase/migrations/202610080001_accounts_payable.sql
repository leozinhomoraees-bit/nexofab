create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  person_type text not null default 'empresa' check (person_type in ('pessoa', 'empresa')),
  legal_name text not null,
  trade_name text,
  document text,
  state_registration text,
  contact_name text,
  phone text,
  whatsapp text,
  email text,
  postal_code text,
  street text,
  address_number text,
  address_complement text,
  district text,
  city text,
  state text,
  default_payment_terms text,
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index suppliers_document_unique
  on public.suppliers (regexp_replace(document, '[^0-9]', '', 'g'))
  where document is not null and regexp_replace(document, '[^0-9]', '', 'g') <> '';
create index suppliers_name_idx on public.suppliers using gin (
  to_tsvector('portuguese', coalesce(legal_name, '') || ' ' || coalesce(trade_name, '') || ' ' || coalesce(document, ''))
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  classification text not null default 'fixo' check (classification in ('fixo', 'variavel', 'investimento', 'imposto', 'financeiro')),
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.payables (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete restrict,
  expense_category_id uuid references public.expense_categories(id) on delete restrict,
  cost_center_id uuid references public.cost_centers(id) on delete restrict,
  description text not null,
  document_type text not null default 'boleto' check (document_type in ('boleto', 'nota_fiscal', 'fatura', 'recibo', 'contrato', 'imposto', 'folha', 'outro')),
  document_number text,
  purchase_order text,
  issue_date date not null default current_date,
  competence_date date not null default current_date,
  total_amount numeric(14,2) not null check (total_amount > 0),
  installment_count integer not null default 1 check (installment_count between 1 and 120),
  recurring boolean not null default false,
  recurrence_frequency text check (recurrence_frequency is null or recurrence_frequency in ('semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  recurrence_end_date date,
  notes text,
  status text not null default 'ativo' check (status in ('ativo', 'cancelado')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payable_installments (
  id uuid primary key default gen_random_uuid(),
  payable_id uuid not null references public.payables(id) on delete restrict,
  installment_number integer not null check (installment_number > 0),
  due_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null default 'boleto' check (payment_method in ('boleto', 'pix', 'transferencia', 'cartao', 'debito_automatico', 'dinheiro', 'outro')),
  digitable_line text,
  pix_code text,
  document_url text,
  status text not null default 'pendente' check (status in ('pendente', 'agendado', 'pago', 'cancelado')),
  scheduled_on date,
  paid_on date,
  paid_amount numeric(14,2) check (paid_amount is null or paid_amount >= 0),
  interest_amount numeric(14,2) not null default 0 check (interest_amount >= 0),
  fine_amount numeric(14,2) not null default 0 check (fine_amount >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  bank_account text,
  receipt_url text,
  payment_notes text,
  paid_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payable_id, installment_number)
);

create index payables_supplier_idx on public.payables (supplier_id, issue_date desc);
create index payables_competence_idx on public.payables (competence_date desc);
create index payable_installments_due_idx on public.payable_installments (due_date, status);
create index payable_installments_payable_idx on public.payable_installments (payable_id, installment_number);

create trigger suppliers_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
create trigger payables_updated_at before update on public.payables for each row execute function public.set_updated_at();
create trigger payable_installments_updated_at before update on public.payable_installments for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;
alter table public.expense_categories enable row level security;
alter table public.cost_centers enable row level security;
alter table public.payables enable row level security;
alter table public.payable_installments enable row level security;

grant select, insert, update on table public.suppliers, public.expense_categories, public.cost_centers, public.payables, public.payable_installments to authenticated;

create policy "finance_read_suppliers" on public.suppliers for select to authenticated
  using (public.has_management_role(array['admin', 'financeiro']));
create policy "finance_manage_suppliers" on public.suppliers for all to authenticated
  using (public.has_management_role(array['admin', 'financeiro']))
  with check (public.has_management_role(array['admin', 'financeiro']));

create policy "finance_read_expense_categories" on public.expense_categories for select to authenticated
  using (public.has_management_role(array['admin', 'financeiro']));
create policy "finance_manage_expense_categories" on public.expense_categories for all to authenticated
  using (public.has_management_role(array['admin', 'financeiro']))
  with check (public.has_management_role(array['admin', 'financeiro']));

create policy "finance_read_cost_centers" on public.cost_centers for select to authenticated
  using (public.has_management_role(array['admin', 'financeiro']));
create policy "finance_manage_cost_centers" on public.cost_centers for all to authenticated
  using (public.has_management_role(array['admin', 'financeiro']))
  with check (public.has_management_role(array['admin', 'financeiro']));

create policy "finance_read_payables" on public.payables for select to authenticated
  using (public.has_management_role(array['admin', 'financeiro']));
create policy "finance_manage_payables" on public.payables for all to authenticated
  using (public.has_management_role(array['admin', 'financeiro']))
  with check (public.has_management_role(array['admin', 'financeiro']));

create policy "finance_read_payable_installments" on public.payable_installments for select to authenticated
  using (public.has_management_role(array['admin', 'financeiro']));
create policy "finance_manage_payable_installments" on public.payable_installments for all to authenticated
  using (public.has_management_role(array['admin', 'financeiro']))
  with check (public.has_management_role(array['admin', 'financeiro']));

-- Categorias e centros de custo começam vazios em cada organização.

create or replace function public.create_payable_with_installments(p_payable jsonb, p_installments jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payable_id uuid;
  v_installment jsonb;
  v_total numeric(14,2);
  v_installment_total numeric(14,2);
  v_count integer;
begin
  if not public.has_management_role(array['admin', 'financeiro']) then
    raise exception 'Acesso financeiro não autorizado';
  end if;
  if jsonb_typeof(p_installments) <> 'array' then raise exception 'Parcelas inválidas'; end if;
  v_total := (p_payable ->> 'total_amount')::numeric;
  v_count := jsonb_array_length(p_installments);
  select coalesce(sum((value ->> 'amount')::numeric), 0) into v_installment_total from jsonb_array_elements(p_installments);
  if v_count < 1 or v_count > 120 or abs(v_total - v_installment_total) > 0.01 then
    raise exception 'A soma das parcelas precisa corresponder ao valor total';
  end if;

  insert into public.payables (
    supplier_id, expense_category_id, cost_center_id, description, document_type,
    document_number, purchase_order, issue_date, competence_date, total_amount,
    installment_count, recurring, recurrence_frequency, recurrence_end_date, notes,
    created_by, updated_by
  ) values (
    nullif(p_payable ->> 'supplier_id', '')::uuid,
    nullif(p_payable ->> 'expense_category_id', '')::uuid,
    nullif(p_payable ->> 'cost_center_id', '')::uuid,
    p_payable ->> 'description', p_payable ->> 'document_type',
    nullif(p_payable ->> 'document_number', ''), nullif(p_payable ->> 'purchase_order', ''),
    (p_payable ->> 'issue_date')::date, (p_payable ->> 'competence_date')::date, v_total,
    v_count, coalesce((p_payable ->> 'recurring')::boolean, false),
    nullif(p_payable ->> 'recurrence_frequency', ''), nullif(p_payable ->> 'recurrence_end_date', '')::date,
    nullif(p_payable ->> 'notes', ''), auth.uid(), auth.uid()
  ) returning id into v_payable_id;

  for v_installment in select value from jsonb_array_elements(p_installments)
  loop
    insert into public.payable_installments (
      payable_id, installment_number, due_date, amount, payment_method,
      digitable_line, pix_code, document_url
    ) values (
      v_payable_id, (v_installment ->> 'installment_number')::integer,
      (v_installment ->> 'due_date')::date, (v_installment ->> 'amount')::numeric,
      v_installment ->> 'payment_method', nullif(v_installment ->> 'digitable_line', ''),
      nullif(v_installment ->> 'pix_code', ''), nullif(v_installment ->> 'document_url', '')
    );
  end loop;
  return v_payable_id;
end;
$$;

create or replace function public.settle_payable_installment(
  p_installment_id uuid, p_paid_on date, p_paid_amount numeric,
  p_interest numeric, p_fine numeric, p_discount numeric,
  p_bank_account text, p_receipt_url text, p_notes text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_management_role(array['admin', 'financeiro']) then raise exception 'Acesso financeiro não autorizado'; end if;
  if p_paid_amount < 0 or p_interest < 0 or p_fine < 0 or p_discount < 0 then raise exception 'Valores de pagamento inválidos'; end if;
  update public.payable_installments set
    status = 'pago', paid_on = p_paid_on, paid_amount = p_paid_amount,
    interest_amount = p_interest, fine_amount = p_fine, discount_amount = p_discount,
    bank_account = nullif(p_bank_account, ''), receipt_url = nullif(p_receipt_url, ''),
    payment_notes = nullif(p_notes, ''), paid_by = auth.uid()
  where id = p_installment_id and status in ('pendente', 'agendado');
  if not found then raise exception 'Parcela não encontrada ou já encerrada'; end if;
end;
$$;

create or replace function public.cancel_payable(p_payable_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_management_role(array['admin', 'financeiro']) then raise exception 'Acesso financeiro não autorizado'; end if;
  if exists (select 1 from public.payable_installments where payable_id = p_payable_id and status = 'pago') then
    raise exception 'Não é possível cancelar uma conta que possui parcela paga';
  end if;
  update public.payables set status = 'cancelado', updated_by = auth.uid() where id = p_payable_id and status = 'ativo';
  if not found then raise exception 'Conta não encontrada ou já cancelada'; end if;
  update public.payable_installments set status = 'cancelado' where payable_id = p_payable_id and status in ('pendente', 'agendado');
end;
$$;

revoke all on function public.create_payable_with_installments(jsonb, jsonb) from public;
revoke all on function public.settle_payable_installment(uuid, date, numeric, numeric, numeric, numeric, text, text, text) from public;
revoke all on function public.cancel_payable(uuid) from public;
grant execute on function public.create_payable_with_installments(jsonb, jsonb) to authenticated;
grant execute on function public.settle_payable_installment(uuid, date, numeric, numeric, numeric, numeric, text, text, text) to authenticated;
grant execute on function public.cancel_payable(uuid) to authenticated;

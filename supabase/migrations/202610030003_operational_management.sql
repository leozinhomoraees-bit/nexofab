create table public.quote_payments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  payment_type text not null default 'entrada' check (payment_type in ('entrada', 'parcela', 'saldo', 'integral')),
  payment_method text not null default 'pix' check (payment_method in ('pix', 'dinheiro', 'cartao', 'boleto', 'transferencia', 'outro')),
  received_on date not null default current_date,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index quote_payments_received_idx on public.quote_payments (received_on desc);
create index quote_payments_quote_idx on public.quote_payments (quote_id);
create unique index production_orders_quote_unique on public.production_orders (quote_id) where quote_id is not null;

alter table public.quote_payments enable row level security;
create policy "staff_read_payments" on public.quote_payments for select to authenticated using (true);

create or replace function public.close_quote_with_deposit(
  p_quote_id uuid,
  p_total_value numeric,
  p_deposit numeric,
  p_payment_method text,
  p_received_on date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_order_id uuid;
  v_payment_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and active and role in ('admin', 'comercial', 'financeiro')
  ) then
    raise exception 'Acesso não autorizado';
  end if;

  if p_total_value <= 0 or p_deposit < 0 or p_deposit > p_total_value then
    raise exception 'Valores do fechamento são inválidos';
  end if;

  if p_payment_method not in ('pix', 'dinheiro', 'cartao', 'boleto', 'transferencia', 'outro') then
    raise exception 'Forma de pagamento inválida';
  end if;

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Orçamento não encontrado'; end if;

  update public.quotes
    set status = 'convertido', estimated_value = p_total_value, subtotal = p_total_value
    where id = p_quote_id;

  if p_deposit > 0 then
    insert into public.quote_payments (quote_id, amount, payment_type, payment_method, received_on, created_by)
    values (p_quote_id, p_deposit, case when p_deposit = p_total_value then 'integral' else 'entrada' end, p_payment_method, p_received_on, auth.uid())
    returning id into v_payment_id;
  end if;

  select id into v_order_id from public.production_orders where quote_id = p_quote_id;
  if v_order_id is null then
    insert into public.production_orders (quote_id, customer_id, title, description, stage, created_by)
    values (p_quote_id, v_quote.customer_id, concat(v_quote.service, ' — ', v_quote.customer_name), v_quote.details, 'briefing', auth.uid())
    returning id into v_order_id;
  end if;

  return jsonb_build_object('quoteId', p_quote_id, 'paymentId', v_payment_id, 'productionOrderId', v_order_id);
end;
$$;

revoke all on function public.close_quote_with_deposit(uuid, numeric, numeric, text, date) from public;
grant execute on function public.close_quote_with_deposit(uuid, numeric, numeric, text, date) to authenticated;

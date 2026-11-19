create or replace function public.register_quick_sale(
  p_customer_id uuid,
  p_customer_name text,
  p_phone text,
  p_items jsonb,
  p_payment_status text,
  p_payment_method text,
  p_sale_date date,
  p_due_date date,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote_id uuid;
  v_quote_number bigint;
  v_order_id uuid;
  v_payment_id uuid;
  v_item jsonb;
  v_total numeric(14,2) := 0;
  v_quantity numeric;
  v_unit_price numeric;
  v_unit_cost numeric;
  v_inventory_id uuid;
  v_stock_quantity numeric;
  v_inventory public.inventory_items%rowtype;
  v_item_count integer;
  v_description text;
begin
  if not public.has_management_role(array['admin', 'comercial', 'financeiro']) then
    raise exception 'Acesso não autorizado';
  end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Itens da venda são inválidos'; end if;
  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 20 then raise exception 'Informe de 1 a 20 itens'; end if;
  if p_payment_status not in ('recebido', 'pendente') then raise exception 'Situação do pagamento inválida'; end if;
  if p_payment_method not in ('pix', 'dinheiro', 'cartao', 'boleto', 'transferencia', 'outro') then raise exception 'Forma de pagamento inválida'; end if;
  if p_payment_status = 'pendente' and p_due_date is null then raise exception 'Informe o vencimento da venda a receber'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := coalesce((v_item ->> 'quantity')::numeric, 0);
    v_unit_price := coalesce((v_item ->> 'unitPrice')::numeric, 0);
    if length(trim(coalesce(v_item ->> 'description', ''))) < 2 or v_quantity <= 0 or v_unit_price <= 0 then
      raise exception 'Confira descrição, quantidade e preço dos itens';
    end if;
    v_total := v_total + round(v_quantity * v_unit_price, 2);
  end loop;

  v_description := case when v_item_count = 1 then trim(p_items -> 0 ->> 'description') else 'Venda rápida de balcão' end;
  insert into public.quotes (
    customer_id, customer_name, phone, service, material, details, quantity,
    status, source, subtotal, discount, estimated_value, internal_notes, created_by
  ) values (
    p_customer_id, coalesce(nullif(trim(p_customer_name), ''), 'Consumidor final'), coalesce(p_phone, ''),
    v_description, 'Venda rápida', nullif(trim(p_notes), ''), 1,
    'convertido', 'presencial', v_total, 0, v_total,
    concat('Venda rápida registrada em ', to_char(p_sale_date, 'DD/MM/YYYY')), auth.uid()
  ) returning id, number into v_quote_id, v_quote_number;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_unit_price := (v_item ->> 'unitPrice')::numeric;
    v_unit_cost := greatest(coalesce((v_item ->> 'unitCost')::numeric, 0), 0);
    v_inventory_id := nullif(v_item ->> 'inventoryItemId', '')::uuid;
    v_stock_quantity := greatest(coalesce((v_item ->> 'stockQuantity')::numeric, 0), 0);

    if v_inventory_id is not null and v_stock_quantity > 0 then
      select * into v_inventory from public.inventory_items where id = v_inventory_id and active = true for update;
      if not found then raise exception 'Insumo de estoque não encontrado'; end if;
      if v_inventory.current_quantity < v_stock_quantity then
        raise exception 'Saldo insuficiente para %: disponível %, necessário %', v_inventory.name, v_inventory.current_quantity, v_stock_quantity;
      end if;
      if v_unit_cost = 0 then v_unit_cost := round((v_inventory.average_cost * v_stock_quantity) / v_quantity, 4); end if;
      update public.inventory_items set current_quantity = current_quantity - v_stock_quantity where id = v_inventory_id;
      insert into public.stock_movements (
        inventory_item_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by
      ) values (
        v_inventory_id, 'saida', v_stock_quantity, v_inventory.average_cost, 'quick_sale', v_quote_id,
        concat('Venda rápida #', v_quote_number), auth.uid()
      );
    end if;

    insert into public.quote_items (
      quote_id, description, service_type, material, quantity, unit, unit_cost, unit_price,
      production_notes, pricing_source, pricing_snapshot, sort_order
    ) values (
      v_quote_id, trim(v_item ->> 'description'), 'venda_rapida',
      nullif(trim(coalesce(v_item ->> 'materialName', '')), ''), v_quantity,
      coalesce(nullif(trim(v_item ->> 'unit'), ''), 'un'), v_unit_cost, v_unit_price,
      nullif(trim(coalesce(v_item ->> 'notes', '')), ''), 'manual',
      jsonb_build_object(
        'quickSale', true,
        'totalCost', round(v_unit_cost * v_quantity, 2),
        'stockUsages', case when v_inventory_id is not null and v_stock_quantity > 0
          then jsonb_build_array(jsonb_build_object('materialId', v_inventory_id, 'materialName', v_inventory.name, 'quantity', v_stock_quantity, 'unit', v_inventory.unit))
          else '[]'::jsonb end
      ),
      (select count(*) from public.quote_items where quote_id = v_quote_id)
    );
  end loop;

  if p_payment_status = 'recebido' then
    insert into public.quote_payments (quote_id, amount, payment_type, payment_method, received_on, notes, created_by)
    values (v_quote_id, v_total, 'integral', p_payment_method, p_sale_date, 'Venda rápida recebida', auth.uid())
    returning id into v_payment_id;
    insert into public.receivable_installments (
      quote_id, installment_number, due_date, amount, payment_method, status,
      received_on, received_amount, quote_payment_id, received_by, notes
    ) values (
      v_quote_id, 0, p_sale_date, v_total, p_payment_method, 'recebido',
      p_sale_date, v_total, v_payment_id, auth.uid(), 'Venda rápida recebida'
    );
  else
    insert into public.receivable_installments (quote_id, installment_number, due_date, amount, payment_method, status, notes)
    values (v_quote_id, 1, p_due_date, v_total, p_payment_method, 'pendente', 'Venda rápida a receber');
  end if;

  insert into public.production_orders (
    quote_id, customer_id, title, description, stage, completed_at, created_by
  ) values (
    v_quote_id, p_customer_id, concat(v_description, ' — ', coalesce(nullif(trim(p_customer_name), ''), 'Consumidor final')),
    'Venda rápida já entregue', 'concluido', now(), auth.uid()
  ) returning id into v_order_id;

  return jsonb_build_object(
    'quoteId', v_quote_id, 'quoteNumber', v_quote_number, 'productionOrderId', v_order_id,
    'paymentId', v_payment_id, 'total', v_total, 'paymentStatus', p_payment_status
  );
end;
$$;

revoke all on function public.register_quick_sale(uuid, text, text, jsonb, text, text, date, date, text) from public;
grant execute on function public.register_quick_sale(uuid, text, text, jsonb, text, text, date, date, text) to authenticated;

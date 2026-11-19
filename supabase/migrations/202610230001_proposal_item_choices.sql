alter table public.quote_items
  add column if not exists option_group text,
  add column if not exists selected_by_customer boolean;

create index if not exists quote_items_option_group_idx
  on public.quote_items (quote_id, option_group)
  where option_group is not null;

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

  select quote_id into v_quote_id
  from public.proposal_shares
  where token_hash = encode(digest(p_token, 'sha256'), 'hex') and revoked_at is null;
  if v_quote_id is null then return null; end if;

  select jsonb_build_object(
    'id', q.id, 'number', q.number, 'customer_name', q.customer_name, 'company', q.company,
    'service', q.service, 'details', q.details, 'status', q.status, 'subtotal', q.subtotal,
    'discount', q.discount, 'estimated_value', q.estimated_value, 'valid_until', q.valid_until,
    'payment_terms', q.payment_terms, 'delivery_days', q.delivery_days,
    'installation_included', q.installation_included, 'freight', q.freight, 'created_at', q.created_at,
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
  from public.quotes q where q.id = v_quote_id;
  return v_result;
end;
$$;

drop function if exists public.respond_public_proposal(text, text);
create function public.respond_public_proposal(
  p_token text,
  p_decision text,
  p_selected_item_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_quote public.quotes%rowtype;
  v_status text;
  v_subtotal numeric(14,2);
  v_discount numeric(14,2);
begin
  if p_decision not in ('aprovar', 'recusar') then
    return jsonb_build_object('saved', false, 'error', 'Resposta inválida.');
  end if;

  select q.* into v_quote
  from public.proposal_shares s
  join public.quotes q on q.id = s.quote_id
  where s.token_hash = encode(digest(p_token, 'sha256'), 'hex') and s.revoked_at is null
  for update of q;

  if v_quote.id is null then return jsonb_build_object('saved', false, 'error', 'Proposta não encontrada.'); end if;
  if v_quote.status = 'convertido' then return jsonb_build_object('saved', false, 'error', 'Esta proposta já foi convertida em ordem de produção.'); end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then
    return jsonb_build_object('saved', false, 'error', 'Esta proposta está fora da validade. Solicite uma atualização.');
  end if;

  if p_decision = 'aprovar' then
    if exists (
      select 1
      from public.quote_items i
      where i.quote_id = v_quote.id and i.option_group is not null
      group by lower(trim(i.option_group))
      having count(*) filter (where i.id = any(coalesce(p_selected_item_ids, array[]::uuid[]))) <> 1
    ) then
      return jsonb_build_object('saved', false, 'error', 'Escolha uma opção em cada grupo antes de aprovar.');
    end if;

    if exists (
      select 1 from unnest(coalesce(p_selected_item_ids, array[]::uuid[])) selected_id
      where not exists (
        select 1 from public.quote_items i
        where i.id = selected_id and i.quote_id = v_quote.id and i.option_group is not null
      )
    ) then
      return jsonb_build_object('saved', false, 'error', 'Uma das opções selecionadas não pertence a esta proposta.');
    end if;

    update public.quote_items
    set selected_by_customer = case
      when option_group is null then true
      else id = any(coalesce(p_selected_item_ids, array[]::uuid[]))
    end
    where quote_id = v_quote.id;

    select coalesce(sum(total), 0) into v_subtotal
    from public.quote_items
    where quote_id = v_quote.id and selected_by_customer is true;
    v_discount := least(coalesce(v_quote.discount, 0), v_subtotal);
    v_status := 'aprovado';

    update public.quotes
    set status = v_status,
        subtotal = v_subtotal,
        discount = v_discount,
        estimated_value = greatest(0, v_subtotal + coalesce(freight, 0) - v_discount)
    where id = v_quote.id;
  else
    v_status := 'recusado';
    update public.quotes set status = v_status where id = v_quote.id;
  end if;

  return jsonb_build_object('saved', true, 'status', v_status);
end;
$$;

revoke all on function public.get_public_proposal(text) from public;
revoke all on function public.respond_public_proposal(text, text, uuid[]) from public;
grant execute on function public.get_public_proposal(text) to anon, authenticated;
grant execute on function public.respond_public_proposal(text, text, uuid[]) to anon, authenticated;

create or replace function public.update_quote_revision(
  p_quote_id uuid,
  p_quote jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.quotes%rowtype;
  v_item jsonb;
  v_position integer := 0;
  v_next_status text;
begin
  if not public.has_management_role(array['admin', 'comercial']) then raise exception 'Acesso não autorizado'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Informe ao menos um item'; end if;

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Orçamento não encontrado'; end if;
  if v_quote.status = 'convertido' then raise exception 'Um orçamento fechado não pode ser editado'; end if;
  v_next_status := case when v_quote.status in ('aprovado', 'recusado', 'expirado') then 'em_analise' else v_quote.status end;

  update public.quotes set
    customer_id = nullif(p_quote ->> 'customerId', '')::uuid,
    customer_name = p_quote ->> 'customerName', company = nullif(p_quote ->> 'company', ''),
    phone = p_quote ->> 'phone', email = nullif(p_quote ->> 'email', ''), service = p_quote ->> 'service',
    dimensions = nullif(p_quote ->> 'dimensions', ''), material = coalesce(nullif(p_quote ->> 'material', ''), 'A definir'),
    details = nullif(p_quote ->> 'details', ''), quantity = greatest(coalesce((p_quote ->> 'quantity')::integer, 1), 1),
    source = p_quote ->> 'source', subtotal = coalesce((p_quote ->> 'subtotal')::numeric, 0),
    discount = coalesce((p_quote ->> 'discount')::numeric, 0), estimated_value = coalesce((p_quote ->> 'estimatedValue')::numeric, 0),
    valid_until = nullif(p_quote ->> 'validUntil', '')::date, payment_terms = nullif(p_quote ->> 'paymentTerms', ''),
    delivery_days = nullif(p_quote ->> 'deliveryDays', '')::integer,
    installation_included = coalesce((p_quote ->> 'installationIncluded')::boolean, false),
    freight = coalesce((p_quote ->> 'freight')::numeric, 0), internal_notes = nullif(p_quote ->> 'internalNotes', ''),
    status = v_next_status
  where id = p_quote_id;

  delete from public.quote_items where quote_id = p_quote_id;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.quote_items (
      quote_id, description, service_type, material, width_mm, height_mm, depth_mm,
      quantity, unit, unit_cost, unit_price, production_notes, pricing_source,
      suggested_unit_price, waste_percent, pricing_snapshot, pricing_product_id,
      option_group, selected_by_customer, sort_order
    ) values (
      p_quote_id, v_item ->> 'description', nullif(v_item ->> 'serviceType', ''), nullif(v_item ->> 'material', ''),
      nullif(v_item ->> 'widthMm', '')::numeric, nullif(v_item ->> 'heightMm', '')::numeric, nullif(v_item ->> 'depthMm', '')::numeric,
      (v_item ->> 'quantity')::numeric, coalesce(nullif(v_item ->> 'unit', ''), 'un'),
      coalesce((v_item ->> 'unitCost')::numeric, 0), coalesce((v_item ->> 'unitPrice')::numeric, 0),
      nullif(v_item ->> 'productionNotes', ''), coalesce(nullif(v_item ->> 'pricingSource', ''), 'manual'),
      nullif(v_item ->> 'suggestedUnitPrice', '')::numeric, nullif(v_item ->> 'wastePercent', '')::numeric,
      v_item -> 'pricingSnapshot', nullif(v_item ->> 'productId', '')::uuid,
      nullif(trim(v_item ->> 'optionGroup'), ''), null, v_position
    );
    v_position := v_position + 1;
  end loop;
  return jsonb_build_object('id', p_quote_id, 'status', v_next_status, 'previousStatus', v_quote.status);
end;
$$;

revoke all on function public.update_quote_revision(uuid, jsonb, jsonb) from public;
grant execute on function public.update_quote_revision(uuid, jsonb, jsonb) to authenticated;

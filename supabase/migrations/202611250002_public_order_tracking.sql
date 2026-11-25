-- Link publico de acompanhamento de Ordem de Servico (/pedido/[token])
-- Garante colunas de agendamento caso esta migration seja executada antes da 202611250001
alter table public.production_orders
  add column if not exists delivery_mode text
    check (delivery_mode in ('retirada', 'entrega', 'instalacao')),
  add column if not exists scheduled_time text,
  add column if not exists site_address text,
  add column if not exists site_notes text,
  add column if not exists public_tracking_token text
    default encode(gen_random_bytes(24), 'hex');

update public.production_orders
set public_tracking_token = encode(gen_random_bytes(24), 'hex')
where public_tracking_token is null or length(public_tracking_token) < 32;

alter table public.production_orders
  alter column public_tracking_token set not null;

create unique index if not exists production_orders_public_tracking_token_uidx
  on public.production_orders (public_tracking_token);

create or replace function public.get_public_order_tracking(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text := lower(trim(coalesce(p_token, '')));
  v_order public.production_orders;
  v_quote public.quotes;
  v_org public.organizations;
  v_items jsonb := '[]'::jsonb;
  v_pending_artwork jsonb := null;
  v_delivery_mode text;
begin
  if v_token !~ '^[a-f0-9]{48}$' then
    return null;
  end if;

  select *
    into v_order
  from public.production_orders
  where public_tracking_token = v_token
  limit 1;

  if v_order.id is null then
    return null;
  end if;

  select *
    into v_org
  from public.organizations
  where id = v_order.organization_id
  limit 1;

  if v_org.id is null then
    return null;
  end if;

  if v_order.quote_id is not null then
    select *
      into v_quote
    from public.quotes
    where id = v_order.quote_id
      and organization_id = v_order.organization_id
    limit 1;

    if v_quote.id is not null then
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'description', qi.description,
            'material', qi.material,
            'quantity', qi.quantity,
            'unit', qi.unit,
            'widthMm', qi.width_mm,
            'heightMm', qi.height_mm
          )
          order by qi.sort_order asc, qi.created_at asc
        ),
        '[]'::jsonb
      )
      into v_items
      from public.quote_items qi
      where qi.quote_id = v_quote.id
        and coalesce(qi.selected_by_customer, true) = true;
    end if;
  end if;

  select jsonb_build_object(
    'token', a.public_token,
    'version', a.version,
    'title', a.title
  )
    into v_pending_artwork
  from public.production_artwork_approvals a
  where a.production_order_id = v_order.id
    and a.status = 'aguardando'
  order by a.version desc
  limit 1;

  v_delivery_mode := coalesce(
    v_order.delivery_mode,
    case
      when v_order.stage = 'instalacao' or coalesce(v_quote.installation_included, false) then 'instalacao'
      when v_order.stage = 'expedicao' then 'entrega'
      else 'retirada'
    end
  );

  return jsonb_build_object(
    'orderNumber', v_order.number,
    'quoteNumber', v_quote.number,
    'title', coalesce(nullif(trim(v_quote.service), ''), v_order.title),
    'stage', v_order.stage,
    'dueAt', v_order.due_at,
    'scheduledTime', v_order.scheduled_time,
    'deliveryMode', v_delivery_mode,
    'startedAt', v_order.started_at,
    'completedAt', v_order.completed_at,
    'createdAt', v_order.created_at,
    'updatedAt', v_order.updated_at,
    'customerLabel', coalesce(nullif(trim(v_quote.company), ''), nullif(trim(v_quote.customer_name), ''), 'Cliente'),
    'items', v_items,
    'pendingArtwork', v_pending_artwork,
    'organization', jsonb_build_object(
      'tradeName', v_org.trade_name,
      'logoUrl', v_org.logo_url,
      'whatsapp', v_org.whatsapp,
      'phone', v_org.phone,
      'email', v_org.email,
      'website', v_org.website,
      'city', v_org.address_city,
      'state', v_org.address_state,
      'footer', v_org.proposal_footer
    )
  );
end;
$$;

revoke all on function public.get_public_order_tracking(text) from public;
grant execute on function public.get_public_order_tracking(text) to anon, authenticated;

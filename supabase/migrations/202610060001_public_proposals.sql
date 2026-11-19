create extension if not exists pgcrypto;

create table if not exists public.proposal_shares (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes(id) on delete cascade,
  token_hash text not null unique check (length(token_hash) = 64),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.proposal_shares enable row level security;

create policy "staff_manage_proposal_shares"
  on public.proposal_shares for all to authenticated
  using (true) with check (true);

revoke all on table public.proposal_shares from anon;
grant select, insert, update, delete on table public.proposal_shares to authenticated;

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
  if p_token is null or length(p_token) < 32 then
    return null;
  end if;

  select quote_id into v_quote_id
  from public.proposal_shares
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and revoked_at is null;

  if v_quote_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', q.id,
    'number', q.number,
    'customer_name', q.customer_name,
    'company', q.company,
    'service', q.service,
    'details', q.details,
    'status', q.status,
    'subtotal', q.subtotal,
    'discount', q.discount,
    'estimated_value', q.estimated_value,
    'valid_until', q.valid_until,
    'payment_terms', q.payment_terms,
    'delivery_days', q.delivery_days,
    'installation_included', q.installation_included,
    'freight', q.freight,
    'created_at', q.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'description', i.description,
        'service_type', i.service_type,
        'material', i.material,
        'width_mm', i.width_mm,
        'height_mm', i.height_mm,
        'quantity', i.quantity,
        'unit', i.unit,
        'unit_price', i.unit_price,
        'total', i.total,
        'sort_order', i.sort_order
      ) order by i.sort_order)
      from public.quote_items i
      where i.quote_id = q.id
    ), '[]'::jsonb)
  ) into v_result
  from public.quotes q
  where q.id = v_quote_id;

  return v_result;
end;
$$;

create or replace function public.respond_public_proposal(p_token text, p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_quote public.quotes%rowtype;
  v_status text;
begin
  if p_decision not in ('aprovar', 'recusar') then
    return jsonb_build_object('saved', false, 'error', 'Resposta inválida.');
  end if;

  select q.* into v_quote
  from public.proposal_shares s
  join public.quotes q on q.id = s.quote_id
  where s.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and s.revoked_at is null
  for update of q;

  if v_quote.id is null then
    return jsonb_build_object('saved', false, 'error', 'Proposta não encontrada.');
  end if;
  if v_quote.status = 'convertido' then
    return jsonb_build_object('saved', false, 'error', 'Esta proposta já foi convertida em ordem de produção.');
  end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then
    return jsonb_build_object('saved', false, 'error', 'Esta proposta está fora da validade. Solicite uma atualização.');
  end if;

  v_status := case when p_decision = 'aprovar' then 'aprovado' else 'recusado' end;
  update public.quotes set status = v_status where id = v_quote.id;
  return jsonb_build_object('saved', true, 'status', v_status);
end;
$$;

revoke all on function public.get_public_proposal(text) from public;
revoke all on function public.respond_public_proposal(text, text) from public;
grant execute on function public.get_public_proposal(text) to anon, authenticated;
grant execute on function public.respond_public_proposal(text, text) to anon, authenticated;

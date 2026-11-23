-- Melhorias Top 3 (Banco):
-- 1. Numeração sequencial independente por empresa (#1, #2, #3...) em quotes e production_orders.
-- 2. Rastreamento de abertura da proposta pública (/proposta/[token]) com alerta no sino sem spam.

-- ============================================================================
-- 1. Numeração sequencial independente por organização (quotes e production_orders)
-- ============================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.organization_sequences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity text not null check (entity in ('quotes', 'production_orders')),
  last_number bigint not null default 0 check (last_number >= 0),
  primary key (organization_id, entity)
);

revoke all on table private.organization_sequences from public, anon, authenticated;

-- Remove identity global e troca unicidade global por unicidade dentro da organização.
alter table public.quotes alter column number drop identity if exists;
alter table public.quotes drop constraint if exists quotes_number_key;
create unique index if not exists quotes_org_number_unique_idx
  on public.quotes (organization_id, number);

alter table public.production_orders alter column number drop identity if exists;
alter table public.production_orders drop constraint if exists production_orders_number_key;
create unique index if not exists production_orders_org_number_unique_idx
  on public.production_orders (organization_id, number);

-- Sincroniza contadores com os registros existentes sem alterar nenhum número já emitido.
insert into private.organization_sequences (organization_id, entity, last_number)
select organization_id, 'quotes', max(number)
from public.quotes
group by organization_id
on conflict (organization_id, entity) do update
  set last_number = greatest(private.organization_sequences.last_number, excluded.last_number);

insert into private.organization_sequences (organization_id, entity, last_number)
select organization_id, 'production_orders', max(number)
from public.production_orders
group by organization_id
on conflict (organization_id, entity) do update
  set last_number = greatest(private.organization_sequences.last_number, excluded.last_number);

create or replace function public.next_organization_number(
  p_organization_id uuid,
  p_entity text
)
returns bigint
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_next bigint;
begin
  if p_organization_id is null then
    raise exception 'Organização obrigatória para gerar numeração';
  end if;
  if p_entity not in ('quotes', 'production_orders') then
    raise exception 'Entidade de numeração inválida';
  end if;

  insert into private.organization_sequences (organization_id, entity, last_number)
  values (p_organization_id, p_entity, 1)
  on conflict (organization_id, entity)
  do update set last_number = private.organization_sequences.last_number + 1
  returning last_number into v_next;

  return v_next;
end;
$$;

revoke all on function public.next_organization_number(uuid, text) from public, anon, authenticated;

create or replace function public.assign_organization_sequence_number()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.number is null or new.number <= 0 then
    new.number := public.next_organization_number(new.organization_id, tg_table_name);
  else
    -- Mantém o contador sincronizado caso um número explícito maior seja gravado em migração/importação
    insert into private.organization_sequences (organization_id, entity, last_number)
    values (new.organization_id, tg_table_name, new.number)
    on conflict (organization_id, entity)
    do update set last_number = greatest(private.organization_sequences.last_number, excluded.last_number);
  end if;
  return new;
end;
$$;

revoke all on function public.assign_organization_sequence_number() from public, anon, authenticated;

-- Prefixo z_ garante execução APÓS set_tenant_context (ordem alfabética do PostgreSQL).
drop trigger if exists z_assign_organization_number on public.quotes;
create trigger z_assign_organization_number
  before insert on public.quotes
  for each row execute function public.assign_organization_sequence_number();

drop trigger if exists z_assign_organization_number on public.production_orders;
create trigger z_assign_organization_number
  before insert on public.production_orders
  for each row execute function public.assign_organization_sequence_number();

-- ============================================================================
-- 2. Rastreamento de visualização da proposta pública (/proposta/[token])
-- ============================================================================

alter table public.proposal_shares
  add column if not exists first_viewed_at timestamptz,
  add column if not exists last_viewed_at timestamptz,
  add column if not exists view_count integer not null default 0 check (view_count >= 0),
  add column if not exists last_view_notified_at timestamptz;

create or replace function public.record_public_proposal_view(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_share public.proposal_shares;
  v_quote public.quotes;
  v_now timestamptz := now();
  v_new_count integer;
  v_should_count boolean;
  v_should_notify boolean;
  v_customer text;
begin
  if p_token is null or length(trim(p_token)) < 32 then
    return jsonb_build_object('recorded', false);
  end if;

  select * into v_share
  from public.proposal_shares
  where token_hash = encode(digest(trim(p_token), 'sha256'), 'hex')
    and revoked_at is null
  for update;

  if v_share.id is null then
    return jsonb_build_object('recorded', false);
  end if;

  select * into v_quote
  from public.quotes
  where id = v_share.quote_id
    and organization_id = v_share.organization_id;

  if v_quote.id is null then
    return jsonb_build_object('recorded', false);
  end if;

  -- Evita inflar contagem com recarregamentos imediatos (janela de 2 minutos)
  v_should_count := v_share.last_viewed_at is null
    or v_share.last_viewed_at < v_now - interval '2 minutes';

  if not v_should_count then
    return jsonb_build_object(
      'recorded', false,
      'viewCount', v_share.view_count,
      'lastViewedAt', v_share.last_viewed_at
    );
  end if;

  v_new_count := coalesce(v_share.view_count, 0) + 1;

  -- Notifica apenas propostas em aberto e com intervalo mínimo de 6h entre avisos
  v_should_notify := v_quote.status in ('novo', 'em_analise', 'aguardando_cliente')
    and (
      v_share.last_view_notified_at is null
      or v_share.last_view_notified_at < v_now - interval '6 hours'
    );

  perform set_config('nexofab.system_organization_id', v_share.organization_id::text, true);

  update public.proposal_shares
  set
    first_viewed_at = coalesce(first_viewed_at, v_now),
    last_viewed_at = v_now,
    view_count = v_new_count,
    last_view_notified_at = case when v_should_notify then v_now else last_view_notified_at end
  where id = v_share.id;

  if v_should_notify then
    v_customer := coalesce(nullif(trim(v_quote.company), ''), nullif(trim(v_quote.customer_name), ''), 'Cliente');

    insert into public.management_notifications (
      organization_id,
      type,
      title,
      message,
      quote_id,
      metadata
    ) values (
      v_share.organization_id,
      'system',
      'Proposta #' || v_quote.number || ' visualizada',
      v_customer || ' abriu a proposta (' || v_new_count || 'ª visualização). Bom momento para fazer o acompanhamento.',
      v_quote.id,
      jsonb_build_object(
        'quoteNumber', v_quote.number,
        'customer', v_customer,
        'phone', coalesce(v_quote.phone, ''),
        'service', coalesce(v_quote.service, ''),
        'viewCount', v_new_count,
        'event', 'proposal_viewed'
      )
    );
  end if;

  perform set_config('nexofab.system_organization_id', '', true);

  return jsonb_build_object(
    'recorded', true,
    'viewCount', v_new_count,
    'lastViewedAt', v_now,
    'notified', v_should_notify
  );
end;
$$;

revoke all on function public.record_public_proposal_view(text) from public;
grant execute on function public.record_public_proposal_view(text) to anon, authenticated;

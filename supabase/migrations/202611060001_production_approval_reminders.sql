-- Coloca o orçamento aceito na fila de produção imediatamente, sem esperar o
-- fechamento financeiro. O fechamento reutiliza a mesma OS pelo quote_id.
create or replace function public.queue_approved_quote_for_production()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_due_at timestamptz;
begin
  if new.status <> 'aprovado' or old.status is not distinct from new.status then
    return new;
  end if;

  v_due_at := case
    when coalesce(new.delivery_days, 0) > 0 then now() + make_interval(days => new.delivery_days)
    else null
  end;

  insert into public.production_orders (
    quote_id, customer_id, title, description, stage, priority, due_at, created_by
  ) values (
    new.id,
    new.customer_id,
    new.service || ' — ' || coalesce(nullif(new.company, ''), new.customer_name),
    coalesce(nullif(new.details, ''), 'Orçamento aceito pelo cliente. Conferir briefing, arquivos, entrada e programar a produção.'),
    'briefing',
    'normal',
    v_due_at,
    auth.uid()
  )
  on conflict (quote_id) where quote_id is not null do update set
    customer_id = excluded.customer_id,
    title = excluded.title,
    description = coalesce(public.production_orders.description, excluded.description),
    due_at = coalesce(public.production_orders.due_at, excluded.due_at),
    updated_at = now()
  where public.production_orders.stage not in ('concluido', 'cancelado');

  return new;
end;
$$;

drop trigger if exists queue_approved_quote_for_production on public.quotes;
create trigger queue_approved_quote_for_production
after update of status on public.quotes
for each row execute function public.queue_approved_quote_for_production();

-- Recupera aprovações existentes que ainda não possuem uma ordem.
insert into public.production_orders (
  quote_id, customer_id, title, description, stage, priority, due_at, created_by
)
select
  q.id,
  q.customer_id,
  q.service || ' — ' || coalesce(nullif(q.company, ''), q.customer_name),
  coalesce(nullif(q.details, ''), 'Orçamento aceito pelo cliente. Conferir briefing, arquivos, entrada e programar a produção.'),
  'briefing',
  'normal',
  case when coalesce(q.delivery_days, 0) > 0
    then coalesce(q.updated_at, q.created_at, now()) + make_interval(days => q.delivery_days)
    else null
  end,
  null
from public.quotes q
where q.status = 'aprovado'
  and not exists (select 1 from public.production_orders po where po.quote_id = q.id);

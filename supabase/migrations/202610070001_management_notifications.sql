create table if not exists public.management_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('proposal_approved', 'proposal_rejected', 'system')),
  title text not null,
  message text not null,
  quote_id uuid references public.quotes(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists management_notifications_created_at_idx
  on public.management_notifications (created_at desc);
create index if not exists management_notifications_unread_idx
  on public.management_notifications (read_at, created_at desc);

alter table public.management_notifications enable row level security;

drop policy if exists "staff_read_management_notifications" on public.management_notifications;
create policy "staff_read_management_notifications"
  on public.management_notifications for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true
  ));

drop policy if exists "staff_update_management_notifications" on public.management_notifications;
create policy "staff_update_management_notifications"
  on public.management_notifications for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true
  ));

grant select, update on table public.management_notifications to authenticated;

create or replace function public.notify_quote_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer text;
  v_total numeric;
begin
  if new.status is not distinct from old.status or new.status not in ('aprovado', 'recusado') then
    return new;
  end if;

  v_customer := coalesce(nullif(new.company, ''), nullif(new.customer_name, ''), 'Cliente');
  v_total := coalesce(new.estimated_value, new.subtotal, 0);

  insert into public.management_notifications (type, title, message, quote_id, metadata)
  values (
    case when new.status = 'aprovado' then 'proposal_approved' else 'proposal_rejected' end,
    case when new.status = 'aprovado'
      then 'Proposta #' || new.number || ' aprovada'
      else 'Proposta #' || new.number || ' recusada'
    end,
    case when new.status = 'aprovado'
      then v_customer || ' aceitou a proposta no valor de R$ ' || replace(to_char(v_total, 'FM999G999G990D00'), '.', ',') || '.'
      else v_customer || ' recusou a proposta. Entre em contato para entender o motivo.'
    end,
    new.id,
    jsonb_build_object(
      'quoteNumber', new.number,
      'customer', v_customer,
      'phone', coalesce(new.phone, ''),
      'service', coalesce(new.service, ''),
      'value', v_total,
      'status', new.status
    )
  );

  return new;
end;
$$;

drop trigger if exists quote_decision_notification on public.quotes;
create trigger quote_decision_notification
after update of status on public.quotes
for each row execute function public.notify_quote_decision();


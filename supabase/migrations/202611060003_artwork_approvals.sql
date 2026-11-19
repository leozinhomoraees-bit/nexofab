create table if not exists public.production_artwork_approvals (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  version integer not null check (version > 0),
  title text not null,
  file_url text not null,
  public_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'aguardando' check (status in ('aguardando', 'aprovada', 'ajustes')),
  customer_notes text,
  responded_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (production_order_id, version)
);

create index if not exists production_artwork_order_idx on public.production_artwork_approvals (production_order_id, version desc);
alter table public.production_artwork_approvals enable row level security;
grant select, insert, update on public.production_artwork_approvals to authenticated;

drop policy if exists "management_artwork_approvals" on public.production_artwork_approvals;
create policy "management_artwork_approvals" on public.production_artwork_approvals
  for all to authenticated
  using (public.has_management_role(array['admin', 'producao', 'comercial']))
  with check (public.has_management_role(array['admin', 'producao', 'comercial']));

create or replace function public.get_public_artwork(p_token text)
returns jsonb language sql security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', a.id, 'title', a.title, 'fileUrl', a.file_url, 'version', a.version,
    'status', a.status, 'customerNotes', a.customer_notes, 'respondedAt', a.responded_at,
    'orderNumber', o.number, 'project', o.title,
    'customer', coalesce(q.company, q.customer_name)
  )
  from public.production_artwork_approvals a
  join public.production_orders o on o.id = a.production_order_id
  left join public.quotes q on q.id = o.quote_id
  where a.public_token = p_token
  limit 1;
$$;

create or replace function public.respond_public_artwork(p_token text, p_decision text, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_status text;
begin
  if p_decision not in ('aprovada', 'ajustes') then return jsonb_build_object('saved', false, 'error', 'Resposta inválida.'); end if;
  update public.production_artwork_approvals set status = p_decision, customer_notes = nullif(trim(p_notes), ''), responded_at = now()
  where public_token = p_token and status = 'aguardando' returning id, status into v_id, v_status;
  if v_id is null then return jsonb_build_object('saved', false, 'error', 'Esta arte já foi respondida ou o link é inválido.'); end if;
  return jsonb_build_object('saved', true, 'status', v_status);
end;
$$;

grant execute on function public.get_public_artwork(text) to anon, authenticated;
grant execute on function public.respond_public_artwork(text, text, text) to anon, authenticated;

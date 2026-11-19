insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artes-aprovacao',
  'artes-aprovacao',
  true,
  12582912,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.production_artwork_approvals
  add column if not exists storage_path text,
  add column if not exists content_type text;

drop policy if exists "management_upload_artwork" on storage.objects;
create policy "management_upload_artwork" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'artes-aprovacao' and public.has_management_role(array['admin', 'producao', 'comercial']));

drop policy if exists "management_update_artwork" on storage.objects;
create policy "management_update_artwork" on storage.objects
  for update to authenticated
  using (bucket_id = 'artes-aprovacao' and public.has_management_role(array['admin', 'producao', 'comercial']))
  with check (bucket_id = 'artes-aprovacao' and public.has_management_role(array['admin', 'producao', 'comercial']));

drop policy if exists "management_delete_artwork" on storage.objects;
create policy "management_delete_artwork" on storage.objects
  for delete to authenticated
  using (bucket_id = 'artes-aprovacao' and public.has_management_role(array['admin', 'producao', 'comercial']));

create or replace function public.get_public_artwork(p_token text)
returns jsonb language sql security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', a.id, 'title', a.title, 'fileUrl', a.file_url, 'contentType', a.content_type, 'version', a.version,
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

grant execute on function public.get_public_artwork(text) to anon, authenticated;

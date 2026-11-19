-- Onboarding, seleção de organização e convites sem service_role.

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','comercial','producao','estoque','financeiro')),
  token_hash text not null unique check (length(token_hash) = 64),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organization_invitations_org_status_idx
  on public.organization_invitations(organization_id, status, created_at desc);
create unique index organization_invitations_pending_email_unique
  on public.organization_invitations(organization_id, lower(email))
  where status = 'pending';

alter table public.organization_invitations enable row level security;

drop policy if exists "admins_manage_membership" on public.organization_members;

drop policy if exists "members_read_membership" on public.organization_members;
create policy "members_read_membership" on public.organization_members
for select to authenticated
using (
  user_id = auth.uid()
  or (
    organization_id = public.current_organization_id()
    and public.has_organization_role(organization_id, array['owner','admin'])
  )
);

create policy "admins_read_invitations" on public.organization_invitations
for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_organization_role(organization_id, array['owner','admin'])
);

drop policy if exists "organization_members_read_profiles" on public.profiles;
create policy "organization_members_read_profiles" on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.organization_members member
    where member.organization_id = public.current_organization_id()
      and member.user_id = profiles.id
      and member.status = 'active'
  )
);

create or replace function public.create_organization_invitation(p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  normalized_email text := lower(trim(p_email));
  raw_token text := encode(gen_random_bytes(32), 'hex');
  invitation public.organization_invitations;
begin
  if v_organization_id is null or not public.has_organization_role(v_organization_id, array['owner','admin']) then
    raise exception 'Apenas administradores podem convidar usuários';
  end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'E-mail inválido';
  end if;
  if p_role not in ('admin','comercial','producao','estoque','financeiro') then
    raise exception 'Papel inválido';
  end if;

  update public.organization_invitations
  set status = 'revoked', updated_at = now()
  where organization_id = v_organization_id
    and lower(email) = normalized_email
    and status = 'pending';

  insert into public.organization_invitations(
    organization_id, email, role, token_hash, invited_by
  ) values (
    v_organization_id,
    normalized_email,
    p_role,
    encode(digest(raw_token, 'sha256'), 'hex'),
    auth.uid()
  ) returning * into invitation;

  return jsonb_build_object(
    'id', invitation.id,
    'token', raw_token,
    'email', invitation.email,
    'role', invitation.role,
    'expires_at', invitation.expires_at
  );
end;
$$;

create or replace function public.accept_organization_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  invitation public.organization_invitations;
  authenticated_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  existing_role text;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  if p_token is null or length(p_token) <> 64 then raise exception 'Convite inválido'; end if;

  select * into invitation
  from public.organization_invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and status = 'pending'
  for update;

  if invitation.id is null then raise exception 'Convite inválido ou já utilizado'; end if;
  if invitation.expires_at <= now() then
    update public.organization_invitations set status = 'expired', updated_at = now() where id = invitation.id;
    raise exception 'Convite expirado';
  end if;
  if authenticated_email = '' or authenticated_email <> lower(invitation.email) then
    raise exception 'Entre com o mesmo e-mail que recebeu o convite';
  end if;

  select role into existing_role
  from public.organization_members
  where organization_id = invitation.organization_id and user_id = auth.uid();

  insert into public.organization_members(organization_id, user_id, role, status, invited_by)
  values (invitation.organization_id, auth.uid(), invitation.role, 'active', invitation.invited_by)
  on conflict (organization_id, user_id) do update set
    role = case when existing_role = 'owner' then 'owner' else excluded.role end,
    status = 'active',
    invited_by = excluded.invited_by,
    updated_at = now();

  update public.organization_invitations
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = now(), updated_at = now()
  where id = invitation.id;

  update public.profiles
  set active_organization_id = invitation.organization_id, updated_at = now()
  where id = auth.uid();

  return invitation.organization_id;
end;
$$;

create or replace function public.revoke_organization_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_organization_id uuid;
begin
  select invitation.organization_id into v_organization_id
  from public.organization_invitations invitation
  where invitation.id = p_invitation_id and invitation.status = 'pending';

  if v_organization_id is null or not public.has_organization_role(v_organization_id, array['owner','admin']) then
    raise exception 'Convite não encontrado';
  end if;

  update public.organization_invitations
  set status = 'revoked', updated_at = now()
  where id = p_invitation_id;
end;
$$;

revoke all on function public.create_organization_invitation(text, text) from public;
revoke all on function public.accept_organization_invitation(text) from public;
revoke all on function public.revoke_organization_invitation(uuid) from public;
grant execute on function public.create_organization_invitation(text, text) to authenticated;
grant execute on function public.accept_organization_invitation(text) to authenticated;
grant execute on function public.revoke_organization_invitation(uuid) to authenticated;
grant select on public.organization_invitations to authenticated;

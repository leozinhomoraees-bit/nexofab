-- Gestão segura de membros da equipe (alterar papel e suspender/reativar) sem abrir escrita direta em organization_members.

create or replace function public.update_organization_member_role(
  p_user_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.current_organization_id();
  v_target public.organization_members;
begin
  if v_org_id is null or not public.has_organization_role(v_org_id, array['owner', 'admin']) then
    raise exception 'Apenas administradores podem gerenciar a equipe';
  end if;
  if p_user_id is null then
    raise exception 'Membro inválido';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Você não pode alterar a própria função';
  end if;
  if p_role not in ('admin', 'comercial', 'producao', 'estoque', 'financeiro') then
    raise exception 'Função inválida';
  end if;

  select * into v_target
  from public.organization_members
  where organization_id = v_org_id
    and user_id = p_user_id
  for update;

  if v_target.user_id is null then
    raise exception 'Membro não encontrado nesta organização';
  end if;
  if v_target.role = 'owner' then
    raise exception 'A função do proprietário não pode ser alterada';
  end if;

  update public.organization_members
  set role = p_role, updated_at = now()
  where organization_id = v_org_id
    and user_id = p_user_id;

  return jsonb_build_object('user_id', p_user_id, 'role', p_role, 'status', v_target.status);
end;
$$;

create or replace function public.set_organization_member_status(
  p_user_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.current_organization_id();
  v_target public.organization_members;
  v_max_users integer;
  v_active_members integer;
begin
  if v_org_id is null or not public.has_organization_role(v_org_id, array['owner', 'admin']) then
    raise exception 'Apenas administradores podem gerenciar a equipe';
  end if;
  if p_user_id is null then
    raise exception 'Membro inválido';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Você não pode alterar o próprio status';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'Status inválido';
  end if;

  select * into v_target
  from public.organization_members
  where organization_id = v_org_id
    and user_id = p_user_id
  for update;

  if v_target.user_id is null then
    raise exception 'Membro não encontrado nesta organização';
  end if;
  if v_target.role = 'owner' then
    raise exception 'O proprietário não pode ser suspenso';
  end if;

  if p_status = 'active' and v_target.status <> 'active' then
    v_max_users := public.organization_max_users(v_org_id);
    select count(*) into v_active_members
    from public.organization_members
    where organization_id = v_org_id and status = 'active';
    if v_max_users is not null and v_active_members >= v_max_users then
      raise exception 'Limite de usuários do plano atingido (% usuários)', v_max_users;
    end if;
  end if;

  update public.organization_members
  set status = p_status, updated_at = now()
  where organization_id = v_org_id
    and user_id = p_user_id;

  if p_status = 'suspended' then
    update public.profiles
    set active_organization_id = null, updated_at = now()
    where id = p_user_id
      and active_organization_id = v_org_id;
  end if;

  return jsonb_build_object('user_id', p_user_id, 'role', v_target.role, 'status', p_status);
end;
$$;

revoke all on function public.update_organization_member_role(uuid, text) from public, anon;
revoke all on function public.set_organization_member_status(uuid, text) from public, anon;
grant execute on function public.update_organization_member_role(uuid, text) to authenticated;
grant execute on function public.set_organization_member_status(uuid, text) to authenticated;

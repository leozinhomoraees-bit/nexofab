-- Seed automático de categorias financeiras e centros de custo padrão ao criar organização
-- + backfill seguro para organizações existentes sem catálogo inicial.

create or replace function public.seed_organization_defaults(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_organization_id is null then
    return;
  end if;

  perform set_config('nexofab.system_organization_id', p_organization_id::text, true);

  insert into public.expense_categories (organization_id, name, classification, color, active)
  select p_organization_id, v.name, v.classification, v.color, true
  from (
    values
      ('Matéria-prima e insumos', 'variavel', '#0e8b81'),
      ('Serviços terceirizados', 'variavel', '#1d8a99'),
      ('Frete e logística', 'variavel', '#2e7d9b'),
      ('Aluguel e condomínio', 'fixo', '#4f6d7a'),
      ('Energia elétrica e água', 'fixo', '#5c7f8c'),
      ('Folha e encargos', 'fixo', '#3c6382'),
      ('Internet, software e telefonia', 'fixo', '#607d8b'),
      ('Manutenção de máquinas', 'fixo', '#8e6b4f'),
      ('Marketing e comercial', 'fixo', '#7c5cbf'),
      ('Impostos e taxas', 'imposto', '#c46a2b'),
      ('Tarifas bancárias e juros', 'financeiro', '#a84a3d'),
      ('Equipamentos e investimentos', 'investimento', '#2d7a4f')
  ) as v(name, classification, color)
  where not exists (
    select 1
    from public.expense_categories c
    where c.organization_id = p_organization_id
      and lower(c.name) = lower(v.name)
  );

  insert into public.cost_centers (organization_id, name, code, active)
  select p_organization_id, v.name, v.code, true
  from (
    values
      ('Administrativo', 'ADM'),
      ('Produção', 'PROD'),
      ('Comercial', 'COM'),
      ('Geral', 'GER')
  ) as v(name, code)
  where not exists (
    select 1
    from public.cost_centers cc
    where cc.organization_id = p_organization_id
      and (lower(cc.name) = lower(v.name) or lower(coalesce(cc.code, '')) = lower(v.code))
  );

  perform set_config('nexofab.system_organization_id', '', true);
end;
$$;

revoke all on function public.seed_organization_defaults(uuid) from public, anon, authenticated;

-- Atualiza create_organization para iniciar trial de 7 dias + catálogos financeiros padrão.
create or replace function public.create_organization(p_trade_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid;
  v_trial_ends_at timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and active
  ) then
    raise exception 'Autenticação obrigatória';
  end if;
  if length(trim(coalesce(p_trade_name, ''))) < 2 or length(trim(p_trade_name)) > 120 then
    raise exception 'Nome da empresa inválido';
  end if;

  insert into public.organizations(trade_name)
  values (trim(p_trade_name))
  returning id into v_organization_id;

  insert into public.organization_members(organization_id, user_id, role, status)
  values (v_organization_id, auth.uid(), 'owner', 'active');

  insert into public.organization_subscriptions(
    organization_id, status, provider, trial_ends_at
  ) values (
    v_organization_id, 'trialing', 'asaas', v_trial_ends_at
  ) on conflict (organization_id) do nothing;

  insert into public.subscription_audit_logs(
    organization_id, actor_user_id, event_type, previous_status, next_status, details
  ) values (
    v_organization_id,
    auth.uid(),
    'trial_started',
    null,
    'trialing',
    jsonb_build_object('trial_days', 7, 'trial_ends_at', v_trial_ends_at, 'provider', 'asaas')
  );

  perform public.seed_organization_defaults(v_organization_id);

  update public.profiles
  set active_organization_id = v_organization_id, updated_at = now()
  where id = auth.uid();

  return v_organization_id;
end;
$$;

revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;

-- Backfill seguro para organizações já existentes que ainda não possuem categorias ou centros de custo.
do $$
declare
  v_org record;
begin
  for v_org in
    select o.id
    from public.organizations o
    where not exists (
      select 1 from public.expense_categories c where c.organization_id = o.id
    ) or not exists (
      select 1 from public.cost_centers cc where cc.organization_id = o.id
    )
  loop
    perform public.seed_organization_defaults(v_org.id);
  end loop;
end;
$$;

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(35);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-0000-0000-000000000001', null, 'authenticated', 'authenticated', 'owner-a@nexofab.test', '', now(), '{}'::jsonb, '{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000002', null, 'authenticated', 'authenticated', 'owner-b@nexofab.test', '', now(), '{}'::jsonb, '{"full_name":"Owner B"}'::jsonb, now(), now()),
  ('30000000-0000-0000-0000-000000000003', null, 'authenticated', 'authenticated', 'suspended@nexofab.test', '', now(), '{}'::jsonb, '{"full_name":"Suspended User"}'::jsonb, now(), now());

insert into public.organizations(id, trade_name) values
  ('a0000000-0000-0000-0000-000000000001', 'Tenant A'),
  ('b0000000-0000-0000-0000-000000000002', 'Tenant B');

insert into public.organization_members(organization_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner', 'active'),
  ('b0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'owner', 'active'),
  ('a0000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'comercial', 'suspended');

update public.profiles set active_organization_id = 'a0000000-0000-0000-0000-000000000001' where id = '10000000-0000-0000-0000-000000000001';
update public.profiles set active_organization_id = 'b0000000-0000-0000-0000-000000000002' where id = '20000000-0000-0000-0000-000000000002';

-- 1 & 2: Tenant A cria registro e trigger atribui organization_id automaticamente
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner-a@nexofab.test"}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.customers(id, name, created_by) values ('a1000000-0000-0000-0000-000000000001', 'Cliente A', auth.uid())$$,
  'Tenant A cria registro sem informar organization_id'
);
select results_eq(
  $$select organization_id from public.customers where id = 'a1000000-0000-0000-0000-000000000001'$$,
  $$values ('a0000000-0000-0000-0000-000000000001'::uuid)$$,
  'Trigger vincula o registro ao tenant ativo'
);
reset role;

-- 3: Tenant B cria cliente, estoque, conta a pagar e orçamento com link público
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated","email":"owner-b@nexofab.test"}', true);
set local role authenticated;
select lives_ok(
  $$
    insert into public.customers(id, name, created_by) values ('b1000000-0000-0000-0000-000000000002', 'Cliente B', auth.uid());
    insert into public.inventory_items(id, name, current_quantity, average_cost, active) values ('b2000000-0000-0000-0000-000000000002', 'Chapa B', 50, 10, true);
    insert into public.payables(id, description, total_amount) values ('b3000000-0000-0000-0000-000000000002', 'Fornecedor B', 250);
    insert into public.quotes(id, customer_id, customer_name, phone, service, subtotal, estimated_value, created_by)
      values ('b4000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'Cliente B', '11999990000', 'Placa B', 500, 500, auth.uid());
    insert into public.quote_items(quote_id, description, quantity, unit_price)
      values ('b4000000-0000-0000-0000-000000000002', 'Item B', 1, 500);
    insert into public.proposal_shares(quote_id, token_hash)
      values ('b4000000-0000-0000-0000-000000000002', encode(digest('token-publico-tenant-b-000000000000000000000000', 'sha256'), 'hex'));
  $$,
  'Tenant B cria seus próprios registros operacionais'
);
reset role;

-- 4 a 11: Isolamento de leitura, escrita, troca de tenant e RPCs SECURITY DEFINER
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner-a@nexofab.test"}', true);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.customers$$,
  $$values (1::bigint)$$,
  'Tenant A enxerga somente seus registros'
);
select is_empty(
  $$select id from public.customers where id = 'b1000000-0000-0000-0000-000000000002'$$,
  'UUID conhecido de outro tenant continua invisível'
);
select throws_ok(
  $$insert into public.customers(name, organization_id) values ('Invasão', 'b0000000-0000-0000-0000-000000000002')$$,
  'P0001',
  'Organização ativa inválida',
  'Insert não pode escolher outro tenant'
);
select throws_ok(
  $$update public.customers set organization_id = 'b0000000-0000-0000-0000-000000000002' where id = 'a1000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Não é permitido mover registros entre organizações',
  'Update não pode mover registro para outro tenant'
);
select throws_ok(
  $$select public.set_active_organization('b0000000-0000-0000-0000-000000000002')$$,
  'P0001',
  'Usuário não pertence a esta organização',
  'Usuário não pode ativar organização alheia'
);
select throws_ok(
  $$select public.update_quote_revision(
    'b4000000-0000-0000-0000-000000000002',
    '{"customerName":"Invadido","phone":"11999990000","service":"Hack","source":"interno"}'::jsonb,
    '[{"description":"Item","quantity":1,"unitPrice":10}]'::jsonb
  )$$,
  'P0001',
  'Orçamento não encontrado',
  'RPC update_quote_revision bloqueia orçamento de outro tenant'
);
select throws_ok(
  $$select public.register_quick_sale(
    null, 'Cliente', '11999990000',
    '[{"description":"Venda","quantity":1,"unitPrice":50,"inventoryItemId":"b2000000-0000-0000-0000-000000000002","stockQuantity":1}]'::jsonb,
    'recebido', 'pix', current_date, null, null
  )$$,
  'P0001',
  'Insumo de estoque não encontrado',
  'RPC register_quick_sale bloqueia baixa de estoque de outro tenant'
);
select throws_ok(
  $$select public.cancel_payable('b3000000-0000-0000-0000-000000000002')$$,
  'P0001',
  'Conta não encontrada ou já cancelada',
  'RPC cancel_payable bloqueia conta a pagar de outro tenant'
);
reset role;

-- 12 & 13: Aprovação pública anônima funciona e propaga o tenant B nos triggers
select set_config('request.jwt.claims', '{}', true);
set local role anon;
select results_eq(
  $$select (public.respond_public_proposal('token-publico-tenant-b-000000000000000000000000', 'aprovar', array[]::uuid[]) ->> 'saved')::boolean$$,
  $$values (true)$$,
  'Aprovação pública anônima conclui sem quebrar set_row_organization()'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated","email":"owner-b@nexofab.test"}', true);
set local role authenticated;
select results_eq(
  $$select (select count(*)::bigint from public.management_notifications where quote_id = 'b4000000-0000-0000-0000-000000000002') + (select count(*)::bigint from public.production_orders where quote_id = 'b4000000-0000-0000-0000-000000000002')$$,
  $$values (2::bigint)$$,
  'Triggers de proposta pública criam notificação e OS dentro do Tenant B'
);
reset role;

-- 14 a 17: Convites (e-mail diferente, expiração, proteção de owner e uso único)
insert into public.organization_invitations (organization_id, email, role, token_hash, invited_by, expires_at) values
  ('a0000000-0000-0000-0000-000000000001', 'owner-a@nexofab.test', 'comercial', encode(digest('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'sha256'), 'hex'), '10000000-0000-0000-0000-000000000001', now() + interval '1 day'),
  ('a0000000-0000-0000-0000-000000000001', 'owner-b@nexofab.test', 'comercial', encode(digest('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'sha256'), 'hex'), '10000000-0000-0000-0000-000000000001', now() - interval '1 minute');

select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated","email":"owner-b@nexofab.test"}', true);
set local role authenticated;
select throws_ok(
  $$select public.accept_organization_invitation('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$$,
  'P0001',
  'Entre com o mesmo e-mail que recebeu o convite',
  'Aceite de convite exige e-mail idêntico ao convidado'
);
select throws_ok(
  $$select public.accept_organization_invitation('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')$$,
  'P0001',
  'Convite expirado',
  'Convite expirado é rejeitado'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner-a@nexofab.test"}', true);
set local role authenticated;
select results_eq(
  $$select public.accept_organization_invitation('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$$,
  $$values ('a0000000-0000-0000-0000-000000000001'::uuid)$$,
  'Convite válido é aceito pelo e-mail correspondente'
);
select results_eq(
  $$select role from public.organization_members where organization_id = 'a0000000-0000-0000-0000-000000000001' and user_id = auth.uid()$$,
  $$values ('owner'::text)$$,
  'Convite com papel menor não rebaixa owner existente'
);
select throws_ok(
  $$select public.accept_organization_invitation('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$$,
  'P0001',
  'Convite inválido ou já utilizado',
  'Convite já aceito não pode ser reutilizado'
);
reset role;

-- 18: Membership suspensa não pode ativar organização
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated","email":"suspended@nexofab.test"}', true);
set local role authenticated;
select throws_ok(
  $$select public.set_active_organization('a0000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'Usuário não pertence a esta organização',
  'Membership suspensa é bloqueada em set_active_organization'
);
reset role;

-- 20 a 27: Portal público por empresa (/p/<slug>), assinatura ativa, isolamento e rate limiting
insert into public.organization_subscriptions (organization_id, status, provider, trial_ends_at) values
  ('a0000000-0000-0000-0000-000000000001', 'trialing', 'asaas', now() + interval '7 days'),
  ('b0000000-0000-0000-0000-000000000002', 'trialing', 'asaas', now() - interval '1 day')
on conflict (organization_id) do update set
  status = excluded.status,
  trial_ends_at = excluded.trial_ends_at;

select throws_ok(
  $$update public.organizations set public_slug = 'gestao' where id = 'a0000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'Slug reservado do sistema é bloqueado na tabela organizations'
);

update public.organizations
set public_slug = 'tenant-a', public_portal_enabled = false, document = '12.345.678/0001-90'
where id = 'a0000000-0000-0000-0000-000000000001';

update public.organizations
set public_slug = 'tenant-b', public_portal_enabled = true
where id = 'b0000000-0000-0000-0000-000000000002';

select set_config('request.jwt.claims', '{}', true);
set local role anon;

select results_eq(
  $$select public.get_public_quote_portal('tenant-a') is null$$,
  $$values (true)$$,
  'Portal desativado retorna nulo para anon'
);

select results_eq(
  $$select public.get_public_quote_portal('tenant-b') is null$$,
  $$values (true)$$,
  'Portal de empresa com assinatura expirada retorna nulo para anon'
);

reset role;
update public.organizations
set public_portal_enabled = true
where id = 'a0000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claims', '{}', true);
set local role anon;

select results_eq(
  $$select (public.get_public_quote_portal('tenant-a') ->> 'trade_name') = 'Tenant A'
      and not (public.get_public_quote_portal('tenant-a') ? 'organization_id')
      and not (public.get_public_quote_portal('tenant-a') ? 'document')$$,
  $$values (true)$$,
  'Portal ativo expõe somente branding público seguro sem organization_id ou CNPJ'
);

select throws_ok(
  $$select public.submit_public_quote_lead(
    'tenant-b', 'Lead Externo', '11999998888', 'Corte a laser',
    null, null, null, 'A definir', null, 1,
    repeat('c', 64)
  )$$,
  'P0001',
  'Portal de orçamento indisponível',
  'Submissão pública é bloqueada para tenant com assinatura expirada'
);

select lives_ok(
  $$select public.submit_public_quote_lead(
    'tenant-a', 'Lead Portal A', '11988887777', 'Router CNC',
    'Empresa Lead', 'lead@exemplo.com', '1x2m', 'ACM', 'Fachada externa', 2,
    repeat('d', 64)
  )$$,
  'Submissão pública anônima cria orçamento para tenant ativo'
);

reset role;

select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated","email":"owner-b@nexofab.test"}', true);
set local role authenticated;
select results_eq(
  $$select (select count(*)::bigint from public.quotes where customer_name = 'Lead Portal A')
      + (select count(*)::bigint from public.management_notifications where title like 'Novo pedido pelo portal%')$$,
  $$values (0::bigint)$$,
  'Tenant B não enxerga lead nem notificação criados no portal do Tenant A'
);
reset role;

select set_config('request.jwt.claims', '{}', true);
set local role anon;
select throws_ok(
  $$
    do $rate$
    begin
      perform public.submit_public_quote_lead('tenant-a', 'Lead 2', '11988887777', 'Laser', null, null, null, 'MDF', null, 1, repeat('d', 64));
      perform public.submit_public_quote_lead('tenant-a', 'Lead 3', '11988887777', 'Laser', null, null, null, 'MDF', null, 1, repeat('d', 64));
      perform public.submit_public_quote_lead('tenant-a', 'Lead 4', '11988887777', 'Laser', null, null, null, 'MDF', null, 1, repeat('d', 64));
      perform public.submit_public_quote_lead('tenant-a', 'Lead 5', '11988887777', 'Laser', null, null, null, 'MDF', null, 1, repeat('d', 64));
      perform public.submit_public_quote_lead('tenant-a', 'Lead 6', '11988887777', 'Laser', null, null, null, 'MDF', null, 1, repeat('d', 64));
    end
    $rate$;
  $$,
  'P0001',
  'Limite de solicitações atingido. Aguarde alguns minutos e tente novamente.',
  'Rate limit bloqueia a sexta solicitação do mesmo IP na mesma hora'
);
reset role;

-- 28 a 35: RBAC granular por departamento diretamente nas políticas RLS
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('40000000-0000-0000-0000-000000000004', null, 'authenticated', 'authenticated', 'producao-a@nexofab.test', '', now(), '{}'::jsonb, '{"full_name":"Producao A"}'::jsonb, now(), now()),
  ('50000000-0000-0000-0000-000000000005', null, 'authenticated', 'authenticated', 'comercial-a@nexofab.test', '', now(), '{}'::jsonb, '{"full_name":"Comercial A"}'::jsonb, now(), now()),
  ('60000000-0000-0000-0000-000000000006', null, 'authenticated', 'authenticated', 'financeiro-a@nexofab.test', '', now(), '{}'::jsonb, '{"full_name":"Financeiro A"}'::jsonb, now(), now());

insert into public.organization_members(organization_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'producao', 'active'),
  ('a0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000005', 'comercial', 'active'),
  ('a0000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000006', 'financeiro', 'active');

update public.profiles
set active_organization_id = 'a0000000-0000-0000-0000-000000000001'
where id in (
  '40000000-0000-0000-0000-000000000004',
  '50000000-0000-0000-0000-000000000005',
  '60000000-0000-0000-0000-000000000006'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner-a@nexofab.test"}', true);
set local role authenticated;
insert into public.payables(id, description, total_amount)
  values ('a3000000-0000-0000-0000-000000000001', 'Aluguel Galpão A', 3500);
insert into public.pricing_fixed_costs(id, name, monthly_amount, active)
  values ('a4000000-0000-0000-0000-000000000001', 'Folha Administrativa', 8000, true);
reset role;

select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-000000000004","role":"authenticated","email":"producao-a@nexofab.test"}', true);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.payables$$,
  $$values (0::bigint)$$,
  'Perfil producao não enxerga contas a pagar da própria empresa via RLS'
);
select results_eq(
  $$select count(*)::bigint from public.pricing_fixed_costs$$,
  $$values (0::bigint)$$,
  'Perfil producao não enxerga custos fixos da própria empresa via RLS'
);
select throws_ok(
  $$insert into public.payables(description, total_amount) values ('Conta indevida', 100)$$,
  '42501',
  null,
  'Perfil producao é bloqueado ao inserir em payables via RLS'
);
select throws_ok(
  $$insert into public.pricing_fixed_costs(name, monthly_amount, active) values ('Custo indevido', 500, true)$$,
  '42501',
  null,
  'Perfil producao é bloqueado ao inserir em pricing_fixed_costs via RLS'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-000000000005","role":"authenticated","email":"comercial-a@nexofab.test"}', true);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.payables$$,
  $$values (0::bigint)$$,
  'Perfil comercial não enxerga contas a pagar da empresa via RLS'
);
select throws_ok(
  $$insert into public.payables(description, total_amount) values ('Conta comercial', 200)$$,
  '42501',
  null,
  'Perfil comercial é bloqueado ao inserir em payables via RLS'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-000000000006","role":"authenticated","email":"financeiro-a@nexofab.test"}', true);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.payables$$,
  $$values (1::bigint)$$,
  'Perfil financeiro enxerga normalmente as contas a pagar do seu tenant'
);
select throws_ok(
  $$insert into public.production_orders(title, stage) values ('OS indevida', 'briefing')$$,
  '42501',
  null,
  'Perfil financeiro é bloqueado ao criar ordem de produção diretamente via RLS'
);
reset role;

select * from finish();

rollback;

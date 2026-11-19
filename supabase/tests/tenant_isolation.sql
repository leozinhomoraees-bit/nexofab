begin;

create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-0000-0000-000000000001', null, 'authenticated', 'authenticated', 'owner-a@nexofab.test', '', now(), '{}'::jsonb, '{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000002', null, 'authenticated', 'authenticated', 'owner-b@nexofab.test', '', now(), '{}'::jsonb, '{"full_name":"Owner B"}'::jsonb, now(), now());

insert into public.organizations(id, trade_name) values
  ('a0000000-0000-0000-0000-000000000001', 'Tenant A'),
  ('b0000000-0000-0000-0000-000000000002', 'Tenant B');

insert into public.organization_members(organization_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner', 'active'),
  ('b0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'owner', 'active');

update public.profiles set active_organization_id = 'a0000000-0000-0000-0000-000000000001' where id = '10000000-0000-0000-0000-000000000001';
update public.profiles set active_organization_id = 'b0000000-0000-0000-0000-000000000002' where id = '20000000-0000-0000-0000-000000000002';

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

select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated","email":"owner-b@nexofab.test"}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.customers(id, name, created_by) values ('b1000000-0000-0000-0000-000000000002', 'Cliente B', auth.uid())$$,
  'Tenant B cria seu próprio registro'
);
reset role;

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
  $$select public.set_active_organization('b0000000-0000-0000-0000-000000000002')$$,
  'P0001',
  'Usuário não pertence a esta organização',
  'Usuário não pode ativar organização alheia'
);
select * from finish();

rollback;

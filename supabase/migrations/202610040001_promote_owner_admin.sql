-- NexoFab não promove usuários por e-mail fixo.
-- A primeira organização e seu owner são criados pelo fluxo de onboarding.
revoke update on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

-- Preferência de projetos guiados visíveis na empresa (para enxugar a lista de orçamentos conforme o segmento)
alter table public.pricing_settings
  add column if not exists disabled_guided_projects text[] not null default '{}';

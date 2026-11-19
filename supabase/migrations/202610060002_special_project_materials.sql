alter table public.pricing_materials drop constraint if exists pricing_materials_category_check;
alter table public.pricing_materials add constraint pricing_materials_category_check check (
  category in ('lona', 'vinil', 'papel', 'tecido', 'chapa', 'tinta', 'filamento', 'acabamento', 'estrutura', 'metal', 'solda', 'acrilico', 'led', 'eletrica', 'embalagem', 'consumivel', 'terceirizado', 'outro')
);

alter table public.pricing_materials drop constraint if exists pricing_materials_format_check;
alter table public.pricing_materials add constraint pricing_materials_format_check check (
  format in ('rolo', 'chapa', 'barra', 'unidade', 'litro', 'kg', 'metro', 'servico')
);

comment on column public.pricing_materials.length_m is 'Comprimento total do rolo ou comprimento unitário da barra/perfil.';
comment on column public.pricing_materials.width_mm is 'Largura de rolo/chapa ou primeira dimensão da seção do perfil.';
comment on column public.pricing_materials.height_mm is 'Altura da chapa ou segunda dimensão da seção do perfil.';

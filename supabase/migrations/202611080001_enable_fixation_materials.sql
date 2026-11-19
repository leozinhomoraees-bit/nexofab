-- Habilita materiais de fixação (fitas, parafusos, rebites, colas e similares)
-- no mesmo cadastro usado por precificação e estoque. Não altera nem remove dados.

alter table public.pricing_materials
  drop constraint if exists pricing_materials_category_check;

alter table public.pricing_materials
  add constraint pricing_materials_category_check check (
    category in (
      'lona', 'vinil', 'papel', 'tecido', 'chapa', 'tinta', 'filamento',
      'acabamento', 'fixacao', 'estrutura', 'metal', 'solda', 'acrilico',
      'led', 'eletrica', 'embalagem', 'consumivel', 'terceirizado', 'outro'
    )
  );

comment on constraint pricing_materials_category_check on public.pricing_materials is
  'Categorias de insumos aceitas pela precificação, incluindo materiais de fixação.';

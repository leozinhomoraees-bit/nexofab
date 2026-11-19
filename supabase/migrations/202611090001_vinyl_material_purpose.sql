-- Classifica vinis por finalidade para impedir combinações tecnicamente inválidas
-- nos orçamentos. Mantém os cadastros existentes e faz uma classificação inicial
-- pelo nome; depois cada material pode ser revisado na tela de Precificação.

alter table public.pricing_materials
  add column if not exists vinyl_type text;

alter table public.pricing_materials
  drop constraint if exists pricing_materials_vinyl_type_check;

alter table public.pricing_materials
  add constraint pricing_materials_vinyl_type_check check (
    vinyl_type is null or vinyl_type in ('imprimivel', 'cor', 'ambos', 'laminacao', 'mascara')
  );

update public.pricing_materials
set vinyl_type = case
  when category <> 'vinil' then null
  when lower(name) ~ '(m[aá]scara|transfer|application[[:space:]]*tape)' then 'mascara'
  when lower(name) ~ '(lamina[cç][aã]o|laminado|transparente|clear)' then 'laminacao'
  when lower(name) ~ '(preto|vermelh|azul|amarel|verde|laranja|rosa|roxo|violeta|cinza|grafite|dourad|prat|cromad|cobre|marrom|bege)' then 'cor'
  else 'imprimivel'
end
where vinyl_type is null;

comment on column public.pricing_materials.vinyl_type is
  'Finalidade do vinil: imprimivel, cor, ambos, laminacao ou mascara.';

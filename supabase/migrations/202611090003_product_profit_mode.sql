alter table public.pricing_products
  add column if not exists profit_calculation_mode text not null default 'margin'
  check (profit_calculation_mode in ('margin', 'markup'));

-- Faixas são normalmente negociadas por acréscimo sobre o custo ou tabela por m².
-- Os demais produtos mantêm exatamente a lógica anterior de margem sobre a venda.
update public.pricing_products
set profit_calculation_mode = 'markup', updated_at = now()
where lower(name) like '%faixa%';

comment on column public.pricing_products.profit_calculation_mode is
  'margin = percentual sobre a venda; markup = acréscimo percentual sobre o custo';

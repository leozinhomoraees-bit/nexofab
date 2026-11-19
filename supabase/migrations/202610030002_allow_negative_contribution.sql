-- Meses atípicos podem ter custo variável maior que a receita.
-- O painel deve sinalizar margem negativa, não impedir o registro contábil.
alter table public.financial_months
  drop constraint if exists financial_months_check;

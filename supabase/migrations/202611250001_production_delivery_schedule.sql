-- Campos de agendamento de entrega e instalacao em campo nas Ordens de Servico
alter table public.production_orders
  add column if not exists delivery_mode text
    check (delivery_mode in ('retirada', 'entrega', 'instalacao')),
  add column if not exists scheduled_time text,
  add column if not exists site_address text,
  add column if not exists site_notes text;

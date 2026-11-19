alter table public.quotes
  add column if not exists payment_terms text,
  add column if not exists delivery_days integer check (delivery_days is null or delivery_days between 0 and 365),
  add column if not exists installation_included boolean not null default false,
  add column if not exists freight numeric(12,2) not null default 0 check (freight >= 0);

create index if not exists quotes_valid_until_idx on public.quotes (valid_until)
where status not in ('convertido', 'recusado', 'expirado');

create index if not exists customers_document_idx on public.customers (document)
where document is not null;

create index if not exists customers_whatsapp_idx on public.customers (whatsapp)
where whatsapp is not null;

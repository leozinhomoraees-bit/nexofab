create table public.financial_months (
  id uuid primary key default gen_random_uuid(),
  competence_month date not null unique,
  gross_revenue numeric(14,2) not null default 0 check (gross_revenue >= 0),
  fixed_costs numeric(14,2) not null default 0 check (fixed_costs >= 0),
  non_cash_costs numeric(14,2) not null default 0 check (non_cash_costs >= 0 and non_cash_costs <= fixed_costs),
  variable_costs numeric(14,2) not null default 0 check (variable_costs >= 0),
  desired_profit numeric(14,2) not null default 0 check (desired_profit >= 0),
  business_days integer not null default 22 check (business_days between 1 and 31),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index financial_months_competence_idx on public.financial_months (competence_month desc);

create trigger financial_months_updated_at
  before update on public.financial_months
  for each row execute function public.set_updated_at();

alter table public.financial_months enable row level security;

create policy "finance_team_read_months"
  on public.financial_months for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.active
        and profiles.role in ('admin', 'financeiro')
    )
  );

create policy "finance_team_insert_months"
  on public.financial_months for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.active
        and profiles.role in ('admin', 'financeiro')
    )
  );

create policy "finance_team_update_months"
  on public.financial_months for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.active
        and profiles.role in ('admin', 'financeiro')
    )
  )
  with check (
    updated_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.active
        and profiles.role in ('admin', 'financeiro')
    )
  );

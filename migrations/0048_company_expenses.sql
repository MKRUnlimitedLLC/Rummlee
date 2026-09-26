create table if not exists company_expenses (
  id text primary key,
  spent_on date not null,
  payee text not null,
  category text not null,
  amount_cents integer not null check (amount_cents > 0),
  business_purpose text not null,
  paid_by text not null,
  has_receipt boolean not null default false,
  test_mode boolean not null default true,
  voided_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists company_expenses_spent_idx on company_expenses (spent_on);

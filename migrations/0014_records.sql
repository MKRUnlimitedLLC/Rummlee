alter table orders add column if not exists tax_cents integer not null default 0;
alter table orders add column if not exists buyer_fee_cents integer not null default 0;
alter table orders add column if not exists seller_fee_cents integer not null default 0;
alter table orders add column if not exists metro text;

create table if not exists support_cases (
  id text primary key,
  profile_id text not null,
  opened_by text not null,
  status text not null default 'open',
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists support_cases_profile_idx on support_cases (profile_id, created_at desc);

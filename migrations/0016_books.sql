alter table orders add column if not exists buyer_percent_cents integer not null default 0;
alter table orders add column if not exists buyer_store_cents integer not null default 0;
alter table orders add column if not exists seller_percent_cents integer not null default 0;
alter table orders add column if not exists seller_store_cents integer not null default 0;
alter table orders add column if not exists buyer_paid_cents integer not null default 0;
alter table orders add column if not exists payout_cents integer;
alter table orders add column if not exists payable_at timestamptz;
alter table orders add column if not exists paid_out_at timestamptz;
alter table orders add column if not exists dispute_status text;
alter table orders add column if not exists dispute_note text;

alter table profiles add column if not exists deleted_at timestamptz;

create table if not exists notices (
  id text primary key,
  user_id text not null,
  kind text not null,
  title text not null,
  body text not null,
  ref_id text,
  created_at timestamptz not null default now()
);
create index if not exists notices_user_idx on notices (user_id, created_at desc);

create table if not exists ledger (
  id text primary key,
  order_id text,
  user_id text,
  account text not null,
  amount_cents integer not null,
  test_mode boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists ledger_order_idx on ledger (order_id);

alter table listings add column if not exists featured_until timestamptz;
alter table sales add column if not exists featured_until timestamptz;
create table if not exists payout_holds (
  id text primary key,
  user_id text not null,
  amount_cents integer not null,
  reason text not null,
  ref_id text,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index if not exists payout_holds_open_idx on payout_holds (user_id) where applied_at is null;

create table if not exists referrers (
  profile_id text primary key,
  role text not null,
  city text,
  status text not null default 'active',
  accepting_signups boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists referred_users (
  user_id text primary key,
  referrer_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists referred_users_referrer_idx on referred_users (referrer_id);

create table if not exists referred_stores (
  spot_id text primary key,
  referrer_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists referred_stores_referrer_idx on referred_stores (referrer_id);

create table if not exists referral_pay (
  id text primary key,
  referrer_id text not null,
  role text not null,
  kind text not null,
  user_id text,
  order_id text,
  spot_id text,
  side text,
  period text,
  basis_cents integer not null default 0,
  amount_cents integer not null,
  status text not null default 'accrued',
  test_mode boolean not null default true,
  void_reason text,
  payout_id text,
  source_key text not null unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists referral_pay_referrer_idx on referral_pay (referrer_id, status);
create index if not exists referral_pay_order_idx on referral_pay (order_id);

create table if not exists referral_payouts (
  id text primary key,
  referrer_id text not null,
  period text not null,
  amount_cents integer not null,
  test_mode boolean not null default true,
  status text not null default 'open',
  note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists referral_payouts_referrer_idx on referral_payouts (referrer_id, status);

alter table orders add column if not exists referral_synced_at timestamptz;


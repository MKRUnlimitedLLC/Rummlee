alter table profiles add column if not exists is_house boolean not null default false;
alter table sales add column if not exists always_on boolean not null default false;
alter table orders add column if not exists disposition text;
alter table orders add column if not exists disposed_at timestamptz;
alter table listings add column if not exists origin text;
alter table listings add column if not exists origin_order_id text;
alter table listings add column if not exists charity_split boolean not null default false;

create unique index if not exists listings_origin_order_idx
  on listings (origin_order_id)
  where origin_order_id is not null;

create table if not exists house_stock (
  id text primary key,
  origin_order_id text not null unique,
  listing_id text not null unique,
  spot_id text not null,
  package_no integer not null,
  market text not null,
  status text not null default 'shelf',
  created_at timestamptz not null default now()
);
create unique index if not exists house_stock_open_pkg
  on house_stock (spot_id, package_no)
  where status = 'shelf';

create table if not exists charity_ledger (
  id text primary key,
  order_id text,
  market text not null,
  amount_cents integer not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists charity_ledger_order_idx on charity_ledger (order_id);

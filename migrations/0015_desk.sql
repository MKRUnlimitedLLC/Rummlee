alter table profiles add column if not exists desk_spot_id text;
alter table orders add column if not exists seller_scan text;
alter table orders add column if not exists buyer_scan text;
alter table orders add column if not exists package_no integer;
alter table orders add column if not exists checked_in_at timestamptz;
alter table orders add column if not exists released_at timestamptz;

create unique index if not exists orders_seller_scan_idx on orders (seller_scan);
create unique index if not exists orders_buyer_scan_idx on orders (buyer_scan);
create unique index if not exists orders_open_package_idx
  on orders (handoff_spot_id, package_no)
  where released_at is null and package_no is not null;

create table if not exists location_devices (
  id text primary key,
  spot_id text not null,
  label text not null,
  secret_hash text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id text primary key,
  handle text not null unique,
  neighborhood text,
  zip text,
  is_premium boolean not null default false,
  wallet_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists handoff_spots (
  id text primary key,
  name text not null,
  area text not null,
  hint text not null
);

create table if not exists sales (
  id text primary key,
  seller_id text not null,
  name text not null,
  kind text not null,
  neighborhood text not null,
  starts_on date not null,
  ends_on date not null,
  handoff_modes text not null default 'porch,official',
  handoff_spot_id text,
  status text not null default 'live',
  created_at timestamptz not null default now()
);
create index if not exists sales_seller_idx on sales (seller_id);
create index if not exists sales_status_idx on sales (status);

create table if not exists listings (
  id text primary key,
  sale_id text not null,
  seller_id text not null,
  title text not null,
  description text not null default '',
  price_cents integer not null,
  buy_now_cents integer,
  original_cents integer,
  category text not null,
  condition text not null,
  haul text not null,
  neighborhood text not null,
  handoff_modes text not null default 'porch,official',
  photo_url text not null,
  status text not null default 'live',
  created_at timestamptz not null default now()
);
create index if not exists listings_sale_idx on listings (sale_id);
create index if not exists listings_seller_idx on listings (seller_id);
create index if not exists listings_status_idx on listings (status);
create index if not exists listings_category_idx on listings (category);

create table if not exists offers (
  id text primary key,
  listing_id text not null,
  buyer_id text not null,
  seller_id text not null,
  amount_cents integer not null,
  counter_cents integer,
  status text not null default 'pending',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists offers_listing_idx on offers (listing_id);
create index if not exists offers_buyer_idx on offers (buyer_id);
create index if not exists offers_seller_idx on offers (seller_id);

create table if not exists messages (
  id text primary key,
  listing_id text not null,
  from_id text not null,
  to_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_listing_idx on messages (listing_id);
create index if not exists messages_from_idx on messages (from_id);
create index if not exists messages_to_idx on messages (to_id);

create table if not exists saved_listings (
  user_id text not null,
  listing_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists orders (
  id text primary key,
  listing_id text not null,
  buyer_id text not null,
  seller_id text not null,
  amount_cents integer not null,
  fee_cents integer not null,
  status text not null default 'escrow',
  pickup_code text not null,
  buyer_confirmed boolean not null default false,
  seller_confirmed boolean not null default false,
  handoff_type text not null default 'porch',
  handoff_spot_id text,
  created_at timestamptz not null default now()
);
create index if not exists orders_buyer_idx on orders (buyer_id);
create index if not exists orders_seller_idx on orders (seller_id);
create unique index if not exists orders_pickup_code_idx on orders (pickup_code);

create table if not exists wallet_tx (
  id text primary key,
  user_id text not null,
  kind text not null,
  amount_cents integer not null,
  ref_id text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists wallet_tx_user_idx on wallet_tx (user_id);

create table if not exists app_meta (
  key text primary key,
  value text not null
);

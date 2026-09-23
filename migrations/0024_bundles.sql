alter table listings add column if not exists bundle_kind text;
alter table listings add column if not exists bundle_for text;

create table if not exists bundle_items (
  bundle_id text not null,
  listing_id text not null,
  primary key (bundle_id, listing_id)
);
create index if not exists bundle_items_listing_idx on bundle_items (listing_id);

create table if not exists offer_uses (
  listing_id text not null,
  buyer_id text not null,
  primary key (listing_id, buyer_id)
);

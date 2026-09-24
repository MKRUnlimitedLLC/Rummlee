create table if not exists listing_facts (
  id text primary key,
  listing_id text not null,
  author_id text not null,
  seller_id text not null,
  field text not null,
  value text not null,
  status text not null default 'proposed',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists listing_facts_listing_idx on listing_facts (listing_id, status);
create index if not exists listing_facts_author_idx on listing_facts (author_id, status);

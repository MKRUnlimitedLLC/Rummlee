alter table profiles add column if not exists is_researcher boolean not null default false;

create table if not exists research_requests (
  id text primary key,
  seller_id text not null,
  note text,
  photos text not null,
  status text not null default 'open',
  charged_cents integer not null,
  payout_cents integer not null,
  researcher_id text,
  title text,
  description text,
  category text,
  condition text,
  low_cents integer,
  high_cents integer,
  description_mark text,
  accuracy_mark text,
  price_mark text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  answered_at timestamptz,
  decided_at timestamptz
);
create index if not exists research_seller_idx on research_requests (seller_id, status);
create index if not exists research_open_idx on research_requests (status, created_at);

create table if not exists research_passes (
  request_id text not null,
  researcher_id text not null,
  primary key (request_id, researcher_id)
);

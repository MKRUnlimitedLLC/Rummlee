alter table profiles add column if not exists rep integer not null default 100;

create table if not exists listing_notes (
  id text primary key,
  listing_id text not null,
  author_id text not null,
  seller_id text not null,
  kind text not null,
  body text not null,
  status text not null default 'proposed',
  helpful integer not null default 0,
  not_helpful integer not null default 0,
  seller_reply text,
  created_at timestamptz not null default now(),
  unique (listing_id, author_id)
);
create index if not exists listing_notes_listing_idx on listing_notes (listing_id, status);

create table if not exists note_votes (
  note_id text not null,
  voter_id text not null,
  vote text not null,
  created_at timestamptz not null default now(),
  primary key (note_id, voter_id)
);

create table if not exists rep_events (
  id text primary key,
  profile_id text not null,
  kind text not null,
  points integer not null,
  ref_id text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, kind, ref_id)
);
create index if not exists rep_events_profile_idx on rep_events (profile_id);

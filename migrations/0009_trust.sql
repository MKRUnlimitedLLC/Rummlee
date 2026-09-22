alter table profiles add column if not exists verified_at timestamptz;
alter table profiles add column if not exists thumbs_up integer not null default 0;
alter table profiles add column if not exists thumbs_down integer not null default 0;

create table if not exists ratings (
  id text primary key,
  order_id text not null,
  rater_id text not null,
  subject_id text not null,
  role text not null,
  showed_up text not null,
  as_agreed text not null,
  respectful text not null,
  overall text not null,
  comment text,
  created_at timestamptz not null default now(),
  unique (order_id, rater_id)
);
create index if not exists ratings_subject_idx on ratings (subject_id);
create index if not exists ratings_order_idx on ratings (order_id);

create table if not exists rating_challenges (
  id text primary key,
  rating_id text not null unique,
  by_id text not null,
  note text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

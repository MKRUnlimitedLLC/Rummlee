create table if not exists rummlee_measures (
  id text primary key,
  event text not null,
  path text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  created_at timestamptz not null default now()
);

create table if not exists identity_checks (
  id text primary key,
  profile_id text not null,
  provider text not null,
  session_id text not null unique,
  status text not null,
  created_at timestamptz not null default now()
);
create index if not exists identity_checks_profile_idx on identity_checks (profile_id);
alter table profiles add column if not exists identity_provider text;

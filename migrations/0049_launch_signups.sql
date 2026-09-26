create table if not exists launch_signups (
  id text primary key,
  email text not null unique,
  created_at timestamptz not null default now()
);

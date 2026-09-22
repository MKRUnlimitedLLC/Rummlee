create table if not exists identity_locks (
  fingerprint text primary key,
  kind text not null,
  profile_id text not null,
  active boolean not null default true,
  thumbs_up integer not null default 0,
  thumbs_down integer not null default 0,
  released_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists identity_locks_profile_idx on identity_locks (profile_id);

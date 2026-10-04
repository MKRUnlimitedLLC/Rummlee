-- Short-lived abuse log for public launch forms.
-- Does not alter or delete launch_signups.

create table if not exists launch_rate_hits (
  id text primary key,
  client_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists launch_rate_hits_client_created
  on launch_rate_hits (client_key, created_at);

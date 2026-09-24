create table if not exists plus_alerts (
  user_id text primary key,
  enabled boolean not null default false,
  instant boolean not null default false,
  categories text not null default '',
  official_on boolean not null default false,
  spot_id text,
  in_person_on boolean not null default false,
  keyword text not null default '',
  max_price_cents integer,
  hauls text not null default '',
  size_label text not null default '',
  counter_only boolean not null default false,
  weekend_only boolean not null default false,
  city text
);

create table if not exists plus_alert_seen (
  user_id text not null,
  ref_id text not null,
  kind text not null,
  primary key (user_id, ref_id, kind)
);

create table if not exists plus_alert_queue (
  id text primary key,
  user_id text not null,
  title text not null,
  body text not null,
  ref_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists plus_alert_queue_open_idx on plus_alert_queue (user_id) where sent_at is null;

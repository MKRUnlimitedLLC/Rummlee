create table if not exists approach_pings (
  id text primary key,
  order_id text not null,
  spot_id text not null,
  role text not null,
  created_at timestamptz not null default now(),
  unique (order_id, role)
);

alter table approach_pings add column if not exists phase text not null default 'close';

create table if not exists counter_marks (
  id text primary key,
  order_id text not null,
  spot_id text not null,
  subject_id text not null,
  side text not null,
  ready text not null,
  created_at timestamptz not null default now(),
  unique (order_id, side)
);

create table if not exists spot_marks (
  id text primary key,
  order_id text not null,
  spot_id text not null,
  rater_id text not null,
  ready text not null,
  created_at timestamptz not null default now(),
  unique (order_id, rater_id)
);

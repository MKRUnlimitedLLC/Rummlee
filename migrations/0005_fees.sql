alter table profiles add column if not exists is_staff boolean not null default false;

create table if not exists rummlee_fees (
  id text primary key,
  label text not null,
  description text not null,
  unit text not null,
  percent_bps integer not null default 0,
  amount_cents integer not null default 0,
  charged_to text not null,
  charged_when text not null,
  sort integer not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

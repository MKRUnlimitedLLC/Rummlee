alter table sales add column if not exists channel text not null default 'online';
alter table sales add column if not exists physical_location text;
alter table sales add column if not exists hours_start text;
alter table sales add column if not exists hours_end text;
alter table sales add column if not exists sale_fee_cents integer not null default 0;
alter table sales add column if not exists sale_free_days integer not null default 0;

create table if not exists sale_days (
  sale_id text not null,
  day date not null,
  charged_cents integer not null default 0,
  primary key (sale_id, day)
);
create index if not exists sale_days_sale_idx on sale_days (sale_id);

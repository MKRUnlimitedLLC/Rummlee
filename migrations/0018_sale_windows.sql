alter table sales add column if not exists online_start_dow smallint;
alter table sales add column if not exists online_end_dow smallint;
alter table sales add column if not exists live_on boolean not null default false;
alter table sales add column if not exists live_start_dow smallint;
alter table sales add column if not exists live_end_dow smallint;
alter table sales add column if not exists live_open text;
alter table sales add column if not exists live_close text;
alter table sales add column if not exists meetup_note text;

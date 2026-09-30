-- Email-only rows stay. path defaults to waitlist; intent, city, zip, and source stay null.

alter table launch_signups add column if not exists path text not null default 'waitlist';
alter table launch_signups add column if not exists phone text;
alter table launch_signups add column if not exists intent text;
alter table launch_signups add column if not exists city text;
alter table launch_signups add column if not exists zip text;
alter table launch_signups add column if not exists business_name text;
alter table launch_signups add column if not exists contact_name text;
alter table launch_signups add column if not exists store_type text;
alter table launch_signups add column if not exists why_us text;
alter table launch_signups add column if not exists hours text;
alter table launch_signups add column if not exists parking text;
alter table launch_signups add column if not exists source text;
alter table launch_signups add column if not exists dedupe text;

alter table launch_signups alter column email drop not null;

update launch_signups
set dedupe = 'waitlist:' || lower(email)
where dedupe is null
  and email is not null
  and path = 'waitlist';

alter table launch_signups drop constraint if exists launch_signups_email_key;

create unique index if not exists launch_signups_dedupe_key on launch_signups (dedupe);

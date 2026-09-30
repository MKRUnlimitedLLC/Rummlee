-- Additive campaign fields. Does not rewrite or delete email-only, waitlist, or handoff rows.

alter table launch_signups add column if not exists utm_source text;
alter table launch_signups add column if not exists utm_medium text;
alter table launch_signups add column if not exists utm_campaign text;
alter table launch_signups add column if not exists utm_content text;
alter table launch_signups add column if not exists utm_term text;

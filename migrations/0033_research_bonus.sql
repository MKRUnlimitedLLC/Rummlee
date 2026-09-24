alter table research_requests add column if not exists listing_id text;
alter table research_requests add column if not exists bonus_paid_at timestamptz;
alter table research_requests add column if not exists range_bonus_cents integer not null default 0;
alter table research_requests add column if not exists asking_bonus_cents integer not null default 0;
create unique index if not exists research_listing_idx on research_requests (listing_id) where listing_id is not null;

alter table researcher_accounts add column if not exists areas text not null default '';
alter table research_requests add column if not exists ask_category text;
alter table research_requests add column if not exists due_at timestamptz;
alter table research_requests add column if not exists held_at timestamptz;

update research_requests
set due_at = claimed_at + interval '15 minutes'
where status = 'claimed' and due_at is null and claimed_at is not null;

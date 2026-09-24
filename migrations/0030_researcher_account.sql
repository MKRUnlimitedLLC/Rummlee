create table if not exists researcher_accounts (
  profile_id text primary key,
  status text not null default 'pending',
  city text not null,
  skills text not null,
  contractor_ok boolean not null default false,
  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text
);

insert into researcher_accounts (profile_id, status, city, skills, contractor_ok)
select id, 'active', coalesce(nullif(city, ''), 'Not set'), 'Already researching', true
from profiles
where is_researcher = true
on conflict (profile_id) do nothing;

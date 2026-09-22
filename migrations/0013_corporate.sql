create table if not exists admissions (
  id text primary key,
  kind text not null,
  status text not null default 'pending',
  org_name text not null,
  contact_name text not null,
  email text not null,
  city text not null,
  note text,
  applicant_id text,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists admissions_status_idx on admissions (status, created_at desc);

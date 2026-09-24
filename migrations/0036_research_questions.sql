alter table research_requests add column if not exists paused_at timestamptz;

create table if not exists research_messages (
  id text primary key,
  request_id text not null,
  author_id text not null,
  body text,
  photos text not null default '[]',
  kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists research_messages_request_idx on research_messages (request_id, created_at);

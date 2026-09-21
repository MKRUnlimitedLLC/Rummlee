alter table handoff_spots add column if not exists kind text not null default 'public';
create index if not exists handoff_spots_kind_idx on handoff_spots (kind);

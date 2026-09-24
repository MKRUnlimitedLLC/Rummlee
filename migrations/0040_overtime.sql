alter table listings add column if not exists overtime_cents integer;
alter table offers add column if not exists phase text not null default 'sale';
create index if not exists listings_overtime_idx on listings (sale_id) where overtime_cents is not null;

alter table listings add column if not exists floor_cents integer;
update listings set floor_cents = price_cents where floor_cents is null;
alter table offers add column if not exists declined_by text;

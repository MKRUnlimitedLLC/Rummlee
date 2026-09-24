create table if not exists reveals (
  id text primary key,
  profile_id text not null,
  listing_id text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, listing_id)
);
create index if not exists reveals_month_idx on reveals (profile_id, created_at);

update rummlee_fees
set description = 'Includes everything in Plus, plus 50 researcher requests a month, 5 free sale days a month, Rummlee Reveal 5 times a month, and no item cap on a sale. Test credits during beta. Researchers are still paid from the researcher payout row.'
where id = 'trio_month';


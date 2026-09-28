insert into rummlee_fees (
  id, label, description, unit, percent_bps, amount_cents, charged_to, charged_when, sort, enabled
) values (
  'seller_plus_floor',
  'Seller fee floor, Plus',
  'Plus seller fee floor. A Plus seller pays this or 8.5%, whichever is more. Standard and +++ stay on the $3.99 floor.',
  'cents',
  0,
  199,
  'seller',
  'checkout',
  74,
  true
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  unit = excluded.unit,
  percent_bps = excluded.percent_bps,
  amount_cents = excluded.amount_cents,
  charged_to = excluded.charged_to,
  charged_when = excluded.charged_when,
  sort = excluded.sort,
  enabled = excluded.enabled,
  updated_at = now();

update rummlee_fees
set description = 'Standard and +++ seller fee floor. $3.99 or 12% Standard, $3.99 or 6% +++. Plus uses the Plus seller fee floor. Same on official store, public place, and in person. Not waived by Plus or +++.',
    updated_at = now()
where id = 'seller_floor';

update rummlee_fees
set description = 'Standard seller percent. The seller pays this or the $3.99 seller fee floor, whichever is more.',
    updated_at = now()
where id = 'seller_payout';

update rummlee_fees
set description = 'Plus seller percent. The seller pays this or the $1.99 Plus seller fee floor, whichever is more. Plus does not waive it.',
    updated_at = now()
where id = 'seller_plus';

update rummlee_fees
set description = '+++ seller percent. The seller pays this or the $3.99 seller fee floor, whichever is more. +++ does not waive it.',
    updated_at = now()
where id = 'seller_trio';

insert into rummlee_fees (
  id, label, description, unit, percent_bps, amount_cents, charged_to, charged_when, sort, enabled
) values (
  'seller_floor_plus',
  'Seller fee floor, Plus',
  'Plus only. The seller pays this or 8.5%, whichever is more. Standard and +++ keep the $3.99 floor. Same on every handoff. Plus does not waive the seller fee.',
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

delete from rummlee_fees where id = 'seller_plus_floor';

update rummlee_fees
set description = 'Standard and +++ floor. The seller pays this or their tier percent, whichever is more. Plus uses its own floor. Same on official store, public place, and in person. Not waived.',
    updated_at = now()
where id = 'seller_floor';

update rummlee_fees
set description = 'Standard seller percent. The seller pays this or the seller fee floor, whichever is more.',
    updated_at = now()
where id = 'seller_payout';

update rummlee_fees
set description = 'Plus seller percent. The seller pays this or the Plus floor, whichever is more. Plus does not waive it.',
    updated_at = now()
where id = 'seller_plus';

update rummlee_fees
set description = '+++ seller percent. The seller pays this or the $3.99 floor, whichever is more. +++ does not use the Plus floor.',
    updated_at = now()
where id = 'seller_trio';

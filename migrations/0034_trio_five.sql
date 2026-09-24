update rummlee_fees
set amount_cents = 2999,
    description = 'Includes everything in Plus, plus 5 researcher requests a month. More are the Ask a researcher fee, one at a time. Also 5 free sale days a month, Rummlee Reveal 5 times a month, and no item cap on a sale. Test credits during beta. Researchers are still paid from the researcher payout row.',
    updated_at = now()
where id = 'trio_month';

update rummlee_fees
set amount_cents = 29999,
    description = 'A year of Rummlee +++. Same benefits as the monthly plan.',
    updated_at = now()
where id = 'trio_year';

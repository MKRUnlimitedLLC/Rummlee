update rummlee_fees
set amount_cents = 625,
    description = 'Paid to the researcher when the seller accepts their write-up. $6.25 is 15 minutes at $25 an hour. Never more than what that seller paid to ask. Not paid if the seller declines.',
    updated_at = now()
where id = 'research_pay';

update rummlee_fees
set amount_cents = 799,
    description = 'Seller pays this to send photos to a Rummlee researcher. They suggest what it is and a price range. The seller still sets the asking price and the lowest price. Covers the researcher payout. Test credits during beta.',
    updated_at = now()
where id = 'research_ask';

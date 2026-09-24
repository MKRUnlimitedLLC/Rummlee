# Rummlee — referral pay, for the bookkeeper

Not a tax opinion and not a filing. Written September 22, 2026. This is how lead and ambassador pay is recorded in the app. It is not on the public site. Beta checkout is still test credits. Do not book a row whose `test_mode` is true.

Owner: Matthew Rau. Marketplace entity to confirm: Rummlee Corp, North Dakota C-corporation. This payable is a company expense, not a cut of the item price and not the seller’s 1099-K.

## What you are booking

Two referral roles. No third referral role. Researchers are a separate contractor job. Their pay is `research_payout` and `research_bonus` on the main ledger, not a row in `referral_pay`. Nobody is paid for recruiting another referrer. One neighbor has one referrer. A person cannot be their own referrer.

**Market lead.** Paid only on neighbors they signed, and on an official store they signed.

| Event | Amount | When the row appears |
|---|---|---|
| Sale, they signed the buyer or the seller | 5% of the fees Rummlee kept on that side | After the seller’s 48-hour payout window closes and the buyer was not refunded |
| Sale, they signed both | 5% on each side (10% of the fees kept) | Same |
| Plus they signed, a month that was paid | $2.50 | That calendar month, while the membership is still on. A yearly plan is one $2.50 per month as the year elapses, not $40 on day one |
| Official store they signed, 50 completed handoffs | $500 once | When 50 official-store handoffs at that store have cleared the 48-hour window |
| Same store, 500 completed handoffs | $2,000 once | Same rule |

Fees Rummlee kept, for the 5% and for the ambassador meter, means the buyer fee, the official-store fees, and Plus charges that were collected. It does not mean the item price, sales tax, a sale-day fee, or the ID-check fee.

**Ambassador.** $25 once, when someone they signed has put $25 of those kept fees into Rummlee. Nothing after that. No cap on how many people. If a market lead is the referrer, the ambassador is not paid on that person.

A refund voids an unpaid sale line. If a store’s completed-handoff count falls back under 50 or 500, an unpaid milestone line is voided. A line already marked paid is not reversed in the app. If that ever happens on real money, book a clawback by hand.

There is no dollar cap and no head cap. The lead’s existing neighbors keep generating lines after a city is open. New neighbors after that should be tagged to ambassadors, not to the lead. The app enforces that only if the lead is saved with new signups turned off. Ask Matthew before tagging a new neighbor to a lead in a city that is already up.

The three people this was written for are not in the database until someone enrolls their handles. Do not accrue them from this memo.

## Where it sits in the app

Staff only, on Corporate. The page does not show amounts.

- Save a referrer by handle, as market lead or ambassador.
- Tag a neighbor to that referrer. One neighbor, one referrer. The app refuses a second tag.
- Tag an official store to a market lead.
- Download the ledger file. That file is the export. Do not close the month from a screenshot.

Public pages do not list these rates. Customer fees stay on the Fees page and at checkout. Do not add referral lines there.

## Tables

`referrers` — who can be paid. `role` is `market_lead` or `ambassador`. `status` is `active` or `closed`. `accepting_signups` false means do not tag new neighbors to them. Their old book still pays.

`referred_users` — one row per neighbor. `referrer_id` is the referrer’s profile id.

`referred_stores` — one official store, one lead.

`referral_pay` — one row per amount owed.

| Column | Meaning |
|---|---|
| kind | `sale_side`, `plus_month`, `store_50`, `store_500`, `ambassador_bonus` |
| amount_cents | What is owed, in cents |
| basis_cents | For a sale: the fee the percent was taken on. For Plus: the Plus charge, not the $2.50. For a store: the handoff count, not dollars. For an ambassador: kept fees at the moment the $25 was earned |
| status | `accrued`, `void`, or `paid` |
| test_mode | True means beta. Not an expense. Not a 1099 |
| period | `YYYY-MM` on Plus rows |
| side | `buyer` or `seller` on sale rows |
| source_key | Stops the same event from paying twice |
| payout_id | Empty until a real batch is closed |

`referral_payouts` — a batch header. Not used while everything is test mode. Do not mark a test batch paid.

`ledger.account = referral_payable` — the same amounts, signed. A void writes the opposite amount. This account is not fee revenue.

`orders.referral_synced_at` — internal. Ignore it.

## How to code a real dollar

Only when `test_mode` is false.

Accrued and not void: debit referral expense, credit referral payable.

| kind | Expense account to open |
|---|---|
| sale_side | Lead commission |
| plus_month | Lead commission — Plus |
| store_50, store_500 | Lead commission — store milestone |
| ambassador_bonus | Ambassador bonus |

Paid: debit referral payable, credit cash.

Keep fee revenue gross. Do not net the 5% or the $2.50 out of the buyer fee, the store fee, or Plus. The store milestone is not owed to the store. There is no $1 store peel in this payable.

Void and unpaid: reverse the accrual. Do not leave it in the payable.

Sales tax never enters these tables. Seller item price never enters these tables. The seller’s 1099-K is unchanged by this expense.

## 1099 and the W-9

This is contractor pay, not the seller’s goods. Ask the CPA whether it is a 1099-NEC. Do not put it on a 1099-K. Do not treat it as wages unless counsel says the person is an employee.

Collect a W-9 (legal name, address, TIN) before the first real check. A handle is not a name for the form. No real check while `test_mode` is true, even if the file shows cents.

## A query that matches the file

```sql
select p.created_at, p.test_mode, pr.handle, p.role, p.kind, p.period, p.side,
       p.basis_cents, p.amount_cents, p.status, p.void_reason, p.payout_id
from referral_pay p
join profiles pr on pr.id = p.referrer_id
where p.test_mode = false
order by p.created_at;
```

Open payable, real money only:

```sql
select pr.handle, sum(p.amount_cents) as open_cents
from referral_pay p
join profiles pr on pr.id = p.referrer_id
where p.test_mode = false and p.status = 'accrued'
group by pr.handle;
```

## What not to do

Do not book test rows. Do not pay from the beta file. Do not add these rates to the customer fee schedule. Do not record a citywide percent. Do not record equity. Do not record a scout. Do not pay a lead for a neighbor they did not sign, including strangers who use a store they signed. The store bonus is the separate $500 and $2,000, once each.

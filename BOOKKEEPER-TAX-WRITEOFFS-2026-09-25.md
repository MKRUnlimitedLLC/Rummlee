# Bookkeeper note — keep the tax legal and the deductions real

Written September 25, 2026. Not a tax opinion and not a return. North Dakota C-corp. Beta checkout is still test credits. A row with `test_mode = true` is not income, not an expense, and not a 1099.

The Corporate desk now has **Company costs**. Staff only. It is not on any public page. Live download: `company_expenses_live.csv`. Beta download is labeled not for the books.

`deductible_cents` is what the code will treat as deductible now. `parked_cents` needs an election or a limit you compute. `blocked_cents` is not deductible. Do not reclass a blocked row into a deductible account because someone wants the year to look smaller.

## What actually lowers the tax

Deduct costs the company paid, in the year they belong, with a receipt and a purpose. Do not invent costs. Do not run a personal bill through the company. A deduction you cannot prove is how a small year becomes a penalty year.

Do these, in this order.

1. **Keep test credits out.** The customer ledger and this new cost file both carry `test_mode`. Import live only.

2. **Adopt a $2,500 de minimis policy in the minute book now.** Equipment at or under $2,500 is parked in the file as `de_minimis_candidate`. It becomes a current deduction only after that written policy exists. Over $2,500 stays on the balance sheet until you elect Section 179 or bonus on the return. The app does not take that election.

3. **Domestic product work is deductible now.** For tax years beginning after December 31, 2024, new Section 174A lets a company deduct domestic research in the year paid. Foreign research stays on a 15-year amort. The file marks domestic rows `qre = true` so you can build the research-credit workpapers. The credit is not automatic. It needs the four-part test and a record of what was uncertain. If you take the credit, ask whether a Section 280C addback is required so the same dollar is not deducted and credited in full. A qualified small business can elect to use a limited amount of the research credit against employer payroll tax. That matters more than a net operating loss while the company has wages and no profit. Confirm the gross-receipts test before you elect it.

4. **Do not bury post-launch hosting in startup costs.** Section 195 is for costs before the business began. The year the business begins, up to $5,000 is deductible, reduced dollar for dollar once those costs pass $50,000, and the rest is 180 months. Hosting, support, and store meetings after the site is open are ordinary, even before the first dollar of profit. Putting them in `pre_opening` slows the deduction. Formation legal and the state filing fee go in `formation` (Section 248), which has its own $5,000. Ongoing counsel is `professional`.

5. **Reimburse founders on an accountable plan.** Receipt, business purpose, and payment back to the founder. The Corporate form will not save a founder row without a receipt. Paid that way, it is a company deduction and not wages. Paid without those facts, it is either wages or a personal cost. Do not gross-up a personal expense and call it a reimbursement. Skip the “rent the house for 14 days” idea unless counsel writes the opinion. It fails more often than it works.

6. **Meals are half. Entertainment is zero.** A dinner with a store owner about a counter is a meal. Tickets are entertainment. The file enforces that split. Gifts, if you add them later, stop at $25 per person per year. Do not code a gift as a meal.

7. **Cash to a real charity is limited.** A C-corp deduction for a gift is generally 10% of taxable income, with a carryforward. The deduction is when the cash is paid to a qualified organization, with their acknowledgment. A pledge is not a deduction. The customer-ledger account `charity_payable` (half of what the company nets on a left-behind resale) is not a deduction until that cash actually goes to the charity. If the company is on the accrual method, a board resolution plus payment within 3½ months after year-end can support an accrual. Do not book the accrual and also book the payment.

8. **Salary is the deduction. A dividend is not.** While there is no profit, do not invent payroll. When there is profit, a documented reasonable salary is deductible and a dividend is not. Zero salary plus distributions is the fact pattern examiners look for. So is a salary that is obviously a dividend. Health insurance for an employee, including a shareholder-employee, can be deductible to the corporation and excluded from the employee’s income if the plan qualifies. That is a C-corp advantage. Do not apply S-corp “above the line” health rules here.

9. **Do not register a state just to feel compliant.** A sales-tax permit you do not need creates returns. North Dakota is the home state: people are already here, so the first real taxable handoff is the permit conversation. Minnesota, Illinois, and South Dakota wait until a real handoff or a person or company-owned goods are there. Sales tax you never owed is not a deduction. Sales tax you collected and remitted is not income. Sales tax you collected and kept can be income.

10. **Illinois may not follow the federal research deduction.** North Dakota conforms on a rolling basis, so 174A should flow through. Minnesota’s last conformity date we have is May 1, 2026, which is after the July 4, 2025 federal change, but confirm the line on the Minnesota return. Illinois uses addbacks. Take the federal deduction. Do not assume it reduces Illinois income until you check the year’s addition schedule.

11. **1099s follow the payment, not the vibe.** For payments after December 31, 2025, the federal 1099-NEC and most 1099-MISC thresholds are $2,000, not $600. The deduction does not wait for the form. Collect a W-9 before the first real check anyway. Attorney fees are reportable even when they are under the threshold. Backup withholding applies if there is no TIN. Contractor rows in the file are marked `needs_1099`. Referral pay stays on its own Corporate export and is the same kind of cost: a commission, deductible when real, never a public page. Researchers are `research_payout` and `research_bonus` on the customer ledger, not this file.

12. **1099-K is a different form.** If the company is the payment intermediary, the federal 1099-K line for 2026 is back to more than $20,000 and more than 200 transactions. Confirm whether Stripe or Rummlee is the one who files. States can be lower. Do not use the federal threshold as a reason to skip seller TINs.

13. **Membership cash is not all income this year.** `plus_deferred` stays deferred and is recognized over the term. Do not pull it into revenue to “use up” a deduction. Losses the company cannot use this year carry forward. A C-corp net operating loss does not wipe a later profitable year in full.

14. **QSBS is a shareholder benefit, not a company deduction.** Do not redeem or reshuffle stock to create it. Do not treat a marketplace as automatically a qualified trade. The brokerage and financial-services exclusion is the question for counsel before anyone promises the exclusion in a raise.

## What this file will not do

It will not deduct a cost with no receipt, except a row you deliberately mark personal, entertainment, political, or a fine, and those rows deduct zero. It will not move a customer fee, a referral percent, or a payout date. It will not turn on a card charge. It will not book ID verification or photo fill. Those stay off in beta.

Close the month from the live CSV plus the receipt folder, not from the Corporate screen.

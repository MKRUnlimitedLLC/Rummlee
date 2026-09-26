import assert from "node:assert/strict";
import test from "node:test";
import { classifyExpense } from "./expenses-policy.ts";

const purpose = "Vercel hosting for the live marketplace in September";

test("a receipt and a purpose make hosting deductible", () => {
  const result = classifyExpense({
    category: "hosting",
    amountCents: 2000,
    hasReceipt: true,
    businessPurpose: purpose,
    paidBy: "company",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.row.deductibleCents, 2000);
  assert.equal(result.row.treatment, "ordinary");
});

test("no receipt is not a deduction", () => {
  const result = classifyExpense({
    category: "hosting",
    amountCents: 2000,
    hasReceipt: false,
    businessPurpose: purpose,
    paidBy: "founder",
  });
  assert.equal(result.ok, false);
});

test("a meal is half, and entertainment is nothing", () => {
  const meal = classifyExpense({
    category: "meals",
    amountCents: 4800,
    hasReceipt: true,
    businessPurpose: "Dinner with a Moorhead store owner about a counter",
    paidBy: "founder",
  });
  assert.equal(meal.ok, true);
  if (!meal.ok) return;
  assert.equal(meal.row.deductibleCents, 2400);
  assert.equal(meal.row.blockedCents, 2400);

  const show = classifyExpense({
    category: "entertainment",
    amountCents: 4800,
    hasReceipt: true,
    businessPurpose: "Tickets for a store owner, not a meal",
    paidBy: "company",
  });
  assert.equal(show.ok, true);
  if (!show.ok) return;
  assert.equal(show.row.deductibleCents, 0);
  assert.equal(show.row.blockedCents, 4800);
});

test("domestic development is a current deduction and a credit file, foreign is not", () => {
  const domestic = classifyExpense({
    category: "domestic_development",
    amountCents: 80_000,
    hasReceipt: true,
    businessPurpose: "Contractor time on handoff custody, the uncertain part",
    paidBy: "company",
  });
  assert.equal(domestic.ok, true);
  if (!domestic.ok) return;
  assert.equal(domestic.row.deductibleCents, 80_000);
  assert.equal(domestic.row.qre, true);
  assert.equal(domestic.row.needs1099, true);

  const foreign = classifyExpense({
    category: "foreign_development",
    amountCents: 80_000,
    hasReceipt: true,
    businessPurpose: "Offshore contractor on the same handoff work",
    paidBy: "company",
  });
  assert.equal(foreign.ok, true);
  if (!foreign.ok) return;
  assert.equal(foreign.row.deductibleCents, 0);
  assert.equal(foreign.row.parkedCents, 80_000);
  assert.equal(foreign.row.qre, false);
});

test("equipment under $2,500 is parked for the de minimis election", () => {
  const small = classifyExpense({
    category: "equipment",
    amountCents: 249_999,
    hasReceipt: true,
    businessPurpose: "Used laptop for the corporate desk",
    paidBy: "company",
  });
  assert.equal(small.ok, true);
  if (!small.ok) return;
  assert.equal(small.row.deductibleCents, 0);
  assert.equal(small.row.treatment, "de_minimis_candidate");

  const large = classifyExpense({
    category: "equipment",
    amountCents: 250_001,
    hasReceipt: true,
    businessPurpose: "Counter scanner and display for a partner store",
    paidBy: "company",
  });
  assert.equal(large.ok, true);
  if (!large.ok) return;
  assert.equal(large.row.treatment, "capitalize");
});

test("a short purpose is rejected", () => {
  const result = classifyExpense({
    category: "hosting",
    amountCents: 100,
    hasReceipt: true,
    businessPurpose: "hosting",
    paidBy: "company",
  });
  assert.equal(result.ok, false);
});

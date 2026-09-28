import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTestMembershipPurchase,
  BELOW_SELLER_FEE,
  checkoutQuote,
  DEFAULT_FEES,
  feeById,
  premiumStillOn,
  priceCoversSellerFee,
  sellerFeeCents,
  TEST_WALLET_MEMBERSHIP,
  type MemberTier,
} from "./fees.ts";

const PRICES = [500, 1000, 2000, 2341, 3325, 4200, 4694, 6650] as const;

function booked(cents: number, tier: MemberTier) {
  return sellerFeeCents(DEFAULT_FEES, cents, tier);
}

test("the seller line is $3.99 or 12, $1.99 or 8.5 Plus, $3.99 or 6", () => {
  assert.equal(feeById(DEFAULT_FEES, "seller_floor")?.amountCents, 399);
  assert.equal(feeById(DEFAULT_FEES, "seller_floor_plus")?.amountCents, 199);
  assert.equal(feeById(DEFAULT_FEES, "seller_payout")?.percentBps, 1200);
  assert.equal(feeById(DEFAULT_FEES, "seller_plus")?.percentBps, 850);
  assert.equal(feeById(DEFAULT_FEES, "seller_trio")?.percentBps, 600);
  assert.equal(feeById(DEFAULT_FEES, "buyer_standard")?.percentBps, 500);
  assert.equal(feeById(DEFAULT_FEES, "buyer_premium")?.percentBps, 0);
  assert.equal(feeById(DEFAULT_FEES, "min_asking")?.amountCents, 500);
  for (const row of DEFAULT_FEES) {
    if (row.id.startsWith("seller_")) assert.equal([0, 600, 850, 1200].includes(row.percentBps), true);
  }
});

test("seller fee at the lock prices", () => {
  const expectFee: Record<MemberTier | "standard", number[]> = {
    standard: [399, 399, 399, 399, 399, 504, 563, 798],
    plus: [199, 199, 199, 199, 283, 357, 399, 565],
    trio: [399, 399, 399, 399, 399, 399, 399, 399],
  };
  PRICES.forEach((cents, i) => {
    assert.equal(booked(cents, null), expectFee.standard[i], `standard ${cents}`);
    assert.equal(booked(cents, "plus"), expectFee.plus[i], `plus ${cents}`);
    assert.equal(booked(cents, "trio"), expectFee.trio[i], `trio ${cents}`);
  });
  assert.equal(booked(1000, "plus"), 199);
  assert.equal(booked(2000, "plus"), 199);
  assert.equal(booked(4200, "plus"), 357);
});

test("checkout books that seller fee and leaves the buyer fee alone", () => {
  const plus = checkoutQuote(DEFAULT_FEES, 4200, { buyer: true, seller: true, sellerTier: "plus" }, "official");
  assert.equal(plus.sellerFeeCents, 357);
  assert.equal(plus.buyerFeeCents, 0);
  assert.equal(plus.handoffFeeCents, 0);
  const standard = checkoutQuote(DEFAULT_FEES, 1000, false, "public");
  assert.equal(standard.sellerFeeCents, 399);
  assert.equal(standard.buyerFeeCents, 50);
  assert.equal(standard.handoffFeeCents, 0);
});

test("a price under the booked seller fee is refused", () => {
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 500, null), true);
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 500, "plus"), true);
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 500, "trio"), true);
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 100, null), false);
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 100, "plus"), false);
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 100, "trio"), false);
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 198, "plus"), false);
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 199, "plus"), true);
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 398, null), false);
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 399, null), true);
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 199, null), false);
  assert.equal(BELOW_SELLER_FEE.includes("below the seller fee"), true);
});

test("a premium flag with no end date is not a membership", () => {
  assert.equal(premiumStillOn(true, null), false);
  assert.equal(premiumStillOn(true, undefined), false);
  assert.equal(premiumStillOn(false, "2099-01-01T00:00:00.000Z"), false);
  assert.equal(premiumStillOn(true, "2000-01-01T00:00:00.000Z"), false);
  assert.equal(premiumStillOn(true, "2099-01-01T00:00:00.000Z"), true);
});

test("plus is not sold from the test wallet once test mode is off", () => {
  assert.doesNotThrow(() => assertTestMembershipPurchase(true));
  assert.throws(() => assertTestMembershipPurchase(false), new Error(TEST_WALLET_MEMBERSHIP));
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTestMembershipPurchase,
  BELOW_SELLER_FEE,
  DEFAULT_FEES,
  feeById,
  premiumStillOn,
  priceCoversSellerFee,
  sellerFeeCents,
  TEST_WALLET_MEMBERSHIP,
} from "./fees.ts";

test("the seller line is $3.99 or 12, $1.99 or 8.5 Plus, $3.99 or 6", () => {
  assert.equal(feeById(DEFAULT_FEES, "seller_floor")?.amountCents, 399);
  assert.equal(feeById(DEFAULT_FEES, "seller_floor_plus")?.amountCents, 199);
  assert.equal(feeById(DEFAULT_FEES, "seller_payout")?.percentBps, 1200);
  assert.equal(feeById(DEFAULT_FEES, "seller_plus")?.percentBps, 850);
  assert.equal(feeById(DEFAULT_FEES, "seller_trio")?.percentBps, 600);
  assert.equal(sellerFeeCents(DEFAULT_FEES, 4000, null), 480);
  assert.equal(sellerFeeCents(DEFAULT_FEES, 4000, "plus"), 340);
  assert.equal(sellerFeeCents(DEFAULT_FEES, 4000, "trio"), 399);
  assert.equal(sellerFeeCents(DEFAULT_FEES, 1000, "plus"), 199);
  assert.equal(sellerFeeCents(DEFAULT_FEES, 1000, null), 399);
  assert.equal(sellerFeeCents(DEFAULT_FEES, 1000, "trio"), 399);
});

test("a one-dollar overtime yes does not cover the seller fee", () => {
  assert.equal(sellerFeeCents(DEFAULT_FEES, 100, null), 399);
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 100, null), false);
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 100, "plus"), false);
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 100, "trio"), false);
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 198, "plus"), false);
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 199, "plus"), true);
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 199, null), false);
  assert.equal(priceCoversSellerFee(DEFAULT_FEES, 500, null), true);
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

import assert from "node:assert/strict";
import test from "node:test";
import { answerBandit, banditTurn, BANDIT_SAMPLE_CENTS } from "./bandit.ts";
import { checkoutQuote, DEFAULT_FEES, feeById, formatFeeValue, type FeeRow } from "./fees.ts";
import { money } from "./format.ts";

function buyerAnswer(table: FeeRow[]) {
  return answerBandit("What is the buyer fee?", table);
}

test("a buyer-fee answer quotes the live table for a $42 item", () => {
  const standard = checkoutQuote(DEFAULT_FEES, BANDIT_SAMPLE_CENTS, { buyer: false, seller: false }, "partner");
  const plus = checkoutQuote(DEFAULT_FEES, BANDIT_SAMPLE_CENTS, { buyer: true, seller: true, sellerTier: "plus" }, "partner");
  const trio = checkoutQuote(DEFAULT_FEES, BANDIT_SAMPLE_CENTS, { buyer: true, seller: true, sellerTier: "trio" }, "partner");
  const answer = buyerAnswer(DEFAULT_FEES);
  assert.match(answer, new RegExp(money(BANDIT_SAMPLE_CENTS).replace("$", "\\$")));
  assert.ok(answer.includes(money(standard.buyerFeeCents)));
  assert.ok(answer.includes(money(plus.buyerFeeCents)));
  assert.ok(answer.includes(money(trio.buyerFeeCents)));
  assert.ok(answer.includes(formatFeeValue(feeById(DEFAULT_FEES, "buyer_standard")!)));
  assert.equal(answer.includes("10%"), false);
  assert.equal(/\$4(?!\d)/.test(answer), false);
  assert.match(answer, /does not waive the seller fee/i);
  assert.match(answer, /buyer fee zero/i);
  assert.equal(answer.includes("sale day"), false);
});

test("a changed buyer percent is spoken from the table, not a fixed 5%", () => {
  const table = DEFAULT_FEES.map((row) => (row.id === "buyer_standard" ? { ...row, percentBps: 700 } : row));
  const answer = buyerAnswer(table);
  const quoted = checkoutQuote(table, BANDIT_SAMPLE_CENTS, { buyer: false, seller: false }, "partner");
  assert.ok(answer.includes("7%"));
  assert.ok(answer.includes(money(quoted.buyerFeeCents)));
  assert.equal(answer.includes(money(checkoutQuote(DEFAULT_FEES, BANDIT_SAMPLE_CENTS, false, "partner").buyerFeeCents)), false);
});

test("Plus is the live monthly price, not a $4 switch", () => {
  const answer = answerBandit("What does Plus cost?", DEFAULT_FEES);
  const plus = feeById(DEFAULT_FEES, "premium_switch");
  assert.ok(plus);
  assert.ok(answer.includes(formatFeeValue(plus)));
  assert.equal(/\$4(?!\d)/.test(answer), false);
  assert.equal(answer.includes("10%"), false);
});

test("a follow-up about the seller stays on the last question", () => {
  const answer = answerBandit("and the seller?", DEFAULT_FEES, "What is the buyer fee?");
  assert.match(answer, /seller fee/i);
  assert.equal(answer.includes("10%"), false);
});

test("write that up returns a note and a short line", () => {
  const turn = banditTurn("Write that up.", DEFAULT_FEES, "What is the buyer fee?");
  assert.equal(turn.say, "I wrote that on a note.");
  assert.ok(turn.note);
  assert.match(turn.note.body, /buyer fee/i);
});

test("photo fill and ID check say priced and off while the flags are off", () => {
  assert.match(answerBandit("What is photo fill?", DEFAULT_FEES), /priced at .+ and off/i);
  assert.match(answerBandit("What is an ID check?", DEFAULT_FEES), /priced at .+ and off/i);
});

test("unknown questions are refused instead of invented", () => {
  assert.equal(answerBandit("What is the referral payout?", DEFAULT_FEES), "I do not have that in this build.");
  assert.equal(answerBandit("Show me a neighbor wallet", DEFAULT_FEES), "I do not have that in this build.");
});

test("handoff order comes from the modes and never a home address", () => {
  const answer = answerBandit("Where do we meet?", null);
  assert.match(answer, /Official store handoff first/);
  assert.match(answer, /Public place handoff second/);
  assert.match(answer, /Private handoff last/);
  assert.match(answer, /Never a home address on a listing/);
  assert.equal(answer.includes("Park Slope"), false);
});

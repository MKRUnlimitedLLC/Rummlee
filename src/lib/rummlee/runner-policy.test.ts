import assert from "node:assert/strict";
import test from "node:test";
import { CHECKR_ENABLED, RUNNERS_ENABLED, RUNNER_WEEKLY_CAP } from "./constants.ts";
import {
  CHECKR_OFF,
  mileQuote,
  RUNNER_REPAY_CENTS,
  runnerRepayCents,
  runnerStep,
  takeRepayment,
  type RunnerGateInput,
} from "./runner-policy.ts";

const now = Date.parse("2026-09-28T18:00:00.000Z");

function gate(over: Partial<RunnerGateInput> = {}): RunnerGateInput {
  return {
    runnersEnabled: true,
    checkrEnabled: true,
    age: 30,
    licenseYears: 8,
    city: "Fargo",
    licenseState: "ND",
    vehicle: "car",
    rangeMiles: 15,
    smallPerMileCents: 200,
    bigPerMileCents: 500,
    insuranceShown: true,
    payoutNoted: true,
    attested: true,
    consented: true,
    hasJobInRange: true,
    orderedThisWeek: 0,
    weeklyCap: 10,
    mvr: "none",
    criminal: "none",
    failedAt: null,
    now,
    ...over,
  };
}

test("runner signup and Checkr stay off", () => {
  assert.equal(RUNNERS_ENABLED, false);
  assert.equal(CHECKR_ENABLED, false);
  assert.equal(RUNNER_WEEKLY_CAP, 10);
  assert.equal(runnerStep(gate({ runnersEnabled: false })).step, "off");
});

test("Minnesota does not repay the check from mile pay", () => {
  assert.equal(runnerRepayCents("Fargo", "ND"), RUNNER_REPAY_CENTS);
  assert.equal(runnerRepayCents("Fargo", "MN"), 0);
  assert.equal(runnerRepayCents("Moorhead", "ND"), 0);
  assert.equal(runnerRepayCents("Minneapolis", "MN"), 0);
});

test("the first $85 of mile pay repays a passed check", () => {
  const first = takeRepayment(3000, 8500);
  assert.equal(first.take, 3000);
  assert.equal(first.paidCents, 0);
  assert.equal(first.leftCents, 5500);
  const done = takeRepayment(6000, 5500);
  assert.equal(done.take, 5500);
  assert.equal(done.paidCents, 500);
  assert.equal(done.leftCents, 0);
  assert.equal(takeRepayment(4000, 0).take, 0);
});

test("range caps the small item and the big item", () => {
  assert.equal(mileQuote(15, 200, 15), 3000);
  assert.equal(mileQuote(16, 200, 15), null);
  assert.equal(mileQuote(15, 500, 15), 7500);
  assert.equal(mileQuote(16, 500, 15), null);
});

test("the driving record is ordered before the criminal search", () => {
  assert.equal(runnerStep(gate()).step, "mvr");
  assert.equal(runnerStep(gate({ mvr: "clear" })).step, "criminal");
  assert.equal(runnerStep(gate({ mvr: "clear", criminal: "clear" })).step, "checked");
  assert.equal(runnerStep(gate({ mvr: "fail", failedAt: now })).step, "failed");
  assert.equal(runnerStep(gate({ hasJobInRange: false })).reason, "No Lux job in your range yet.");
  assert.equal(runnerStep(gate({ checkrEnabled: false })).reason, CHECKR_OFF);
  assert.equal(runnerStep(gate({ orderedThisWeek: 10 })).reason, "The weekly check cap is full.");
  assert.equal(runnerStep(gate({ consented: false })).step, "draft");
});

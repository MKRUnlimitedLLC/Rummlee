import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isSamplePartnerSpot,
  isSampleStoreCard,
  publicSpotHint,
  sampleStoreEyebrow,
} from "./sample-store.ts";

test("seeded counters are samples and an admitted store id is not", () => {
  assert.equal(isSamplePartnerSpot("partner-slope"), true);
  assert.equal(isSamplePartnerSpot("partner-westfargo"), true);
  assert.equal(isSamplePartnerSpot("partner-a1b2c3d4"), false);
  assert.equal(isSamplePartnerSpot("partner-"), false);
  assert.equal(isSamplePartnerSpot(null), false);
  assert.equal(isSampleStoreCard({ handoffSpotId: "partner-austin", sellerId: "user-1", partner: true }), true);
  assert.equal(isSampleStoreCard({ handoffSpotId: "partner-a1b2c3d4", sellerId: "user-1", partner: true }), false);
  assert.equal(isSampleStoreCard({ handoffSpotId: null, sellerId: "seed-linen-lark", partner: true }), true);
  assert.equal(isSampleStoreCard({ handoffSpotId: null, sellerId: "seed-linen-lark", partner: false }), false);
});

test("sample hints drop the official-store claim and keep the lot note", () => {
  assert.equal(sampleStoreEyebrow("partner-slope"), "Sample · not signed");
  assert.equal(sampleStoreEyebrow("partner-a1b2c3d4"), "Official store handoff");
  assert.equal(
    publicSpotHint(
      "partner-slope",
      "Official store. Customer lot, locker by the florist. Step-free entrance, curb cut. Store hours.",
    ),
    "Sample only. No store has signed. Customer lot, locker by the florist. Step-free entrance, curb cut. Store hours.",
  );
  assert.equal(
    publicSpotHint("partner-lincoln", "Official Rummlee partner. Rear lot, store hours only."),
    "Sample only. No store has signed. Rear lot, store hours only.",
  );
  const already = "Sample only. No store has signed. Rear lot, store hours only.";
  assert.equal(publicSpotHint("partner-lincoln", already), already);
  const admitted = "Official store. Admitted by corporate. Store hours. Step-free if the store says so.";
  assert.equal(publicSpotHint("partner-a1b2c3d4", admitted), admitted);
});

test("the handoff form is not covered by the fixed text-size dialog", () => {
  const shell = readFileSync("src/components/app-shell.tsx", "utf8");
  const reading = readFileSync("src/components/reading-choice.tsx", "utf8");
  assert.match(shell, /handoffPage \? <ReadingAsk placement="flow" \/> : null/);
  assert.match(shell, /handoffPage \? null : <ReadingAsk \/>/);
  assert.match(reading, /placement === "flow"/);
  assert.equal(reading.includes('placement === "flow"\n          ? "fixed'), false);
});

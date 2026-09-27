import assert from "node:assert/strict";
import test from "node:test";
import { banditAccessCode, banditCodesMatch, banditGateToken, banditTokenMatches } from "./bandit-gate.ts";

const SAMPLE = "sample-gate-code";

test("a blank access code never opens", () => {
  assert.equal(banditAccessCode({}), "");
  assert.equal(banditCodesMatch(SAMPLE, ""), false);
  assert.equal(banditCodesMatch("", SAMPLE), false);
  assert.equal(banditTokenMatches(banditGateToken(SAMPLE), ""), false);
});

test("only the configured code matches, and the device token follows it", () => {
  assert.equal(banditCodesMatch(`  ${SAMPLE}  `, SAMPLE), true);
  assert.equal(banditCodesMatch("nope", SAMPLE), false);
  const token = banditGateToken(SAMPLE);
  assert.equal(banditTokenMatches(token, SAMPLE), true);
  assert.equal(banditTokenMatches(token, "other-code"), false);
  assert.equal(banditTokenMatches("0".repeat(token.length), SAMPLE), false);
  assert.equal(token.includes(SAMPLE), false);
});

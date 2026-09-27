import assert from "node:assert/strict";
import test from "node:test";
import { codeMatches, sessionOk, sessionToken } from "./bandit-gate.server.ts";

test("the briefing code is checked on the server, not echoed", () => {
  assert.equal(codeMatches("nope"), false);
  assert.equal(codeMatches("  Kite-4419  "), true);
  assert.equal(sessionToken().includes("Kite"), false);
  assert.equal(sessionOk(sessionToken()), true);
  assert.equal(sessionOk("Kite-4419"), false);
  assert.equal(sessionOk(undefined), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLaunchEmail } from "./launch-email.ts";

test("a launch address is trimmed and lowercased", () => {
  assert.equal(normalizeLaunchEmail("  Ada@Example.com "), "ada@example.com");
  assert.equal(normalizeLaunchEmail("not-an-email"), null);
  assert.equal(normalizeLaunchEmail(""), null);
});

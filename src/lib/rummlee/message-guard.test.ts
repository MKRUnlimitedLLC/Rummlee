import assert from "node:assert/strict";
import test from "node:test";
import { offAppContact } from "./message-guard.ts";

test("a question about the item stays", () => {
  assert.equal(offAppContact("Does the lamp still work?"), false);
  assert.equal(offAppContact("I can pick it up Saturday at the store."), false);
});

test("a note that leaves the app is blocked", () => {
  assert.equal(offAppContact("Text me at 701-555-0199"), true);
  assert.equal(offAppContact("email me at pat@example.com"), true);
  assert.equal(offAppContact("I'm on facebook as pat"), true);
  assert.equal(offAppContact("Meet at 7389 17th St"), true);
  assert.equal(offAppContact("see www.craigslist.org"), true);
});

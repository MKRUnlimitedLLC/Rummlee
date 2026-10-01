import assert from "node:assert/strict";
import test from "node:test";
import { rememberFunnelStep, resetFunnelMemory } from "./funnel-memory.ts";

function memory(): Storage {
  const bag = new Map<string, string>();
  return {
    get length() {
      return bag.size;
    },
    clear: () => bag.clear(),
    getItem: (key) => bag.get(key) ?? null,
    key: (index) => [...bag.keys()][index] ?? null,
    removeItem: (key) => bag.delete(key),
    setItem: (key, value) => bag.set(key, value),
  };
}

test("a listing step counts once until the draft is reset", () => {
  const storage = memory();
  assert.equal(rememberFunnelStep("started", storage), true);
  assert.equal(rememberFunnelStep("started", storage), false);
  assert.equal(rememberFunnelStep("photo", storage), true);
  resetFunnelMemory(storage);
  assert.equal(rememberFunnelStep("started", storage), true);
});

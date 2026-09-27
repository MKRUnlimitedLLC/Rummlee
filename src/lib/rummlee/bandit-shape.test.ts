import assert from "node:assert/strict";
import test from "node:test";
import { dogMask, simplifyLoop, traceDog } from "./bandit-shape.ts";

test("the white page drops away and the outline closes", () => {
  const width = 24;
  const height = 16;
  const rgba = new Uint8ClampedArray(width * height * 4);
  rgba.fill(255);
  for (let y = 4; y < 12; y += 1) {
    for (let x = 6; x < 18; x += 1) {
      const o = (y * width + x) * 4;
      rgba[o] = 10;
      rgba[o + 1] = 10;
      rgba[o + 2] = 10;
    }
  }
  const mask = dogMask(width, height, rgba);
  assert.equal(mask[0], 0);
  assert.equal(mask[8 * width + 10], 1);
  const loop = simplifyLoop(traceDog(mask, width, height), 1.2);
  assert.ok(loop.length >= 4);
  assert.ok(loop.length < 80);
});

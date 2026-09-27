import assert from "node:assert/strict";
import test from "node:test";
import { renderExplainPage, TESTFLIGHT_URL } from "./explain.server.ts";

test("the explainer is generated from the current rules", async () => {
  const html = await renderExplainPage();
  assert.match(html, /Nothing ships/);
  assert.match(html, /noindex, nofollow/);
  assert.match(html, new RegExp(TESTFLIGHT_URL.replaceAll("/", "\\/")));
  assert.equal(html.includes("Kite-4419"), false);
  assert.equal(html.includes("garage sale app"), false);
});

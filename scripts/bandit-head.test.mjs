import assert from "node:assert/strict";
import test from "node:test";
import { rewriteBanditHead } from "./bandit-head.mjs";

test("bandit head keeps Bandit and drops the Rummlee manifest", () => {
  const html = `<!doctype html><html><head>
    <title>Rummlee</title>
    <meta name="apple-mobile-web-app-title" content="Rummlee">
    <link rel="manifest" href="/__grok/manifest.webmanifest">
    <link rel="apple-touch-icon" href="/__grok/icon-180.png">
    <link rel="manifest" href="/bandit/manifest.webmanifest">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <meta name="apple-mobile-web-app-title" content="Bandit">
  </head><body>dog</body></html>`;
  const out = rewriteBanditHead(html);
  assert.match(out, /<title>Bandit<\/title>/);
  assert.equal(out.includes("/__grok/manifest.webmanifest"), false);
  assert.equal(out.includes("/__grok/icon-180.png"), false);
  assert.equal(out.includes('content="Rummlee"'), false);
  assert.ok(out.includes('href="/bandit/manifest.webmanifest"'));
  assert.ok(out.includes('href="/apple-touch-icon.png"'));
  assert.ok(out.includes('content="Bandit"'));
});

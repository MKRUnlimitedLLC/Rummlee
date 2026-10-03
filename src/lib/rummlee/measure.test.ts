import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CONSENT_BOOT,
  adsSendTo,
  buildMeasureRow,
  consentSetCookie,
  googleIds,
  gtagScriptUrl,
  readConsent,
} from "./measure.ts";

test("consent boots denied and does not call Google", () => {
  assert.match(CONSENT_BOOT, /ad_storage:'denied'/);
  assert.match(CONSENT_BOOT, /analytics_storage:'denied'/);
  assert.match(CONSENT_BOOT, /security_storage:'granted'/);
  assert.equal(CONSENT_BOOT.includes("googletagmanager"), false);
});

test("google ids must look real or the pixel stays off", () => {
  assert.deepEqual(googleIds(undefined, undefined), []);
  assert.deepEqual(googleIds("not-an-id", "AW-nope"), []);
  assert.deepEqual(googleIds("G-ABC123", "AW-123456789"), ["G-ABC123", "AW-123456789"]);
  assert.equal(gtagScriptUrl("G-ABC123"), "https://www.googletagmanager.com/gtag/js?id=G-ABC123");
  assert.equal(gtagScriptUrl("https://evil.example"), null);
  assert.equal(adsSendTo("AW-123456789/signup1"), "AW-123456789/signup1");
  assert.equal(adsSendTo("signup"), null);
});

test("the choice cookie is first-party and readable", () => {
  const baked = consentSetCookie("all", true);
  assert.match(baked, /^rummlee_consent=all; Path=\/; Max-Age=15552000; SameSite=Lax; Secure$/);
  assert.equal(readConsent(`a=1; ${consentSetCookie("essential", false).split(";")[0]}`), "essential");
  assert.equal(readConsent(""), null);
  assert.equal(readConsent("rummlee_consent=marketing"), null);
});

test("a measure row keeps the ad tags and drops anything else", () => {
  const row = buildMeasureRow("launch_signup", "/handoff", "?utm_source=google&utm_medium=cpc&utm_campaign=launch_w1&utm_content=signup&email=ada@example.com");
  assert.deepEqual(row, {
    event: "launch_signup",
    path: "/handoff",
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "launch_w1",
    utm_content: "signup",
  });
  assert.equal(buildMeasureRow("purchase", "/", ""), null);
  assert.equal(buildMeasureRow("page_view", "https://evil.example", ""), null);
});

test("the banner and the page boot are wired", () => {
  const banner = readFileSync("src/components/cookie-consent.tsx", "utf8");
  const root = readFileSync("src/routes/__root.tsx", "utf8");
  const privacy = readFileSync("src/routes/privacy.tsx", "utf8");
  assert.match(banner, /Essential only/);
  assert.match(banner, /Allow measurement/);
  assert.equal(banner.includes("No advertising cookies"), false);
  assert.match(root, /CONSENT_BOOT/);
  assert.match(privacy, /Allow measurement/);
  assert.equal(privacy.includes("We do not use\n          advertising cookies"), false);
});

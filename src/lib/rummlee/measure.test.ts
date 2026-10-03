import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CONSENT_BOOT,
  META_HANDOFF_APPLY,
  META_LEAD,
  META_PAGE_VIEW,
  META_PIXEL_SRC,
  adsSendTo,
  buildMeasureRow,
  consentSetCookie,
  googleIds,
  gtagScriptUrl,
  metaEventFor,
  metaPixelId,
  planMetaLoad,
  readConsent,
} from "./measure.ts";

test("consent boots denied and does not call Google", () => {
  assert.match(CONSENT_BOOT, /ad_storage:'denied'/);
  assert.match(CONSENT_BOOT, /analytics_storage:'denied'/);
  assert.match(CONSENT_BOOT, /security_storage:'granted'/);
  assert.equal(CONSENT_BOOT.includes("googletagmanager"), false);
  assert.equal(CONSENT_BOOT.includes("connect.facebook.net"), false);
  assert.equal(CONSENT_BOOT.includes("fbevents.js"), false);
  assert.equal(CONSENT_BOOT.includes("facebook.com/tr"), false);
});

test("meta pixel id must be numeric or the pixel stays off", () => {
  assert.equal(metaPixelId(undefined), null);
  assert.equal(metaPixelId(""), null);
  assert.equal(metaPixelId("   "), null);
  assert.equal(metaPixelId("12345"), null);
  assert.equal(metaPixelId("12345678901234"), null);
  assert.equal(metaPixelId("123456789012345678"), null);
  assert.equal(metaPixelId("G-ABC123"), null);
  assert.equal(metaPixelId("123456789012345a"), null);
  assert.equal(metaPixelId("123456789012345"), "123456789012345");
  assert.equal(metaPixelId(" 1234567890123456 "), "1234567890123456");
  assert.equal(planMetaLoad(null, "123456789012345"), null);
  assert.equal(planMetaLoad("essential", "123456789012345"), null);
  assert.equal(planMetaLoad("all", undefined), null);
  assert.equal(planMetaLoad("all", ""), null);
  assert.equal(planMetaLoad("all", "not-a-pixel"), null);
  assert.deepEqual(planMetaLoad("all", "123456789012345"), {
    id: "123456789012345",
    src: META_PIXEL_SRC,
  });
  assert.equal(META_PIXEL_SRC.includes("facebook.com/tr"), false);
  assert.equal(META_PAGE_VIEW, "PageView");
  assert.equal(META_LEAD, "Lead");
  assert.equal(META_HANDOFF_APPLY, "HandoffApply");
  assert.deepEqual(metaEventFor("launch_signup"), { method: "track", name: "Lead" });
  assert.deepEqual(metaEventFor("handoff_apply"), { method: "trackCustom", name: "HandoffApply" });
  assert.equal(metaEventFor("page_view"), null);
  assert.equal(metaEventFor("investor_signup"), null);
  assert.deepEqual(googleIds("G-ABC123", "AW-123456789"), ["G-ABC123", "AW-123456789"]);
  assert.equal(gtagScriptUrl("G-ABC123"), "https://www.googletagmanager.com/gtag/js?id=G-ABC123");
});

test("meta does not request facebook before measurement consent", () => {
  const root = readFileSync("src/routes/__root.tsx", "utf8");
  const banner = readFileSync("src/components/cookie-consent.tsx", "utf8");
  const browser = readFileSync("src/lib/rummlee/measure-browser.ts", "utf8");
  const measure = readFileSync("src/lib/rummlee/measure.ts", "utf8");
  const forms = readFileSync("src/components/launch-forms.tsx", "utf8");
  for (const file of [root, banner, browser, CONSENT_BOOT]) {
    assert.equal(file.includes("connect.facebook.net"), false);
    assert.equal(file.includes("fbevents.js"), false);
    assert.equal(file.includes("facebook.com/tr"), false);
  }
  assert.equal(measure.includes("facebook.com/tr"), false);
  assert.match(browser, /if \(armed \|\| currentConsent\(\) !== "all"\) return;/);
  assert.match(browser, /loadGoogle\(\);\s*loadMeta\(\);/);
  assert.match(
    browser,
    /const plan = planMetaLoad\(currentConsent\(\), metaPixelEnv\(\)\);\s*if \(!plan \|\| document\.querySelector\("script\[data-rummlee-meta\]"\)\) return;/,
  );
  assert.match(browser, /script\.src = plan\.src/);
  assert.match(browser, /fbq\("init", plan\.id\)/);
  assert.equal(/fbq\("init",[^)]+,/.test(browser), false);
  assert.match(browser, /window\.fbq\(call\.method, call\.name\)/);
  assert.match(forms, /track\("launch_signup"\)/);
  assert.match(forms, /track\("handoff_apply"\)/);
  assert.equal(forms.includes("fbq"), false);
  assert.equal(browser.includes("VITE_META_PIXEL_ID"), true);
  assert.equal(/\d{15,16}/.test(browser), false);
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

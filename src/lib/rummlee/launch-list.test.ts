import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { normalizeLaunchEmail } from "./launch-email.ts";
import {
  INTENT_OPTIONS,
  LAUNCH_CSV_HEADER,
  handoffSuccess,
  launchSignupCsv,
  parseHandoff,
  parseWaitlist,
  waitlistSuccess,
  type LaunchExportRow,
} from "./launch-capture.ts";

test("a launch address is trimmed and lowercased", () => {
  assert.equal(normalizeLaunchEmail("  Ada@Example.com "), "ada@example.com");
  assert.equal(normalizeLaunchEmail("not-an-email"), null);
  assert.equal(normalizeLaunchEmail(""), null);
});

test("intent choices are buyer, seller, and both", () => {
  assert.deepEqual(
    INTENT_OPTIONS.map((item) => [item.value, item.label]),
    [
      ["buyer", "Notify me when listings go live near me"],
      ["seller", "Notify me when I can list"],
      ["both", "Buyer and seller"],
    ],
  );
});

test("waitlist requires email, intent, and city or zip", () => {
  assert.equal(parseWaitlist({ email: "ada@example.com", intent: "buyer", city: "Fargo" }).ok, true);
  assert.equal(parseWaitlist({ email: "ada@example.com", intent: "seller", zip: "58102" }).ok, true);
  assert.equal(parseWaitlist({ email: "", intent: "buyer", city: "Fargo" }).ok, false);
  assert.equal(parseWaitlist({ email: "ada@example.com", intent: "", city: "Fargo" }).ok, false);
  assert.equal(parseWaitlist({ email: "ada@example.com", intent: "buyer" }).ok, false);
  assert.equal(parseWaitlist({ email: "ada@example.com", intent: "buyer", zip: "12" }).ok, false);
});

test("waitlist success names the city, or the area when only a ZIP is stored", () => {
  const withCity = parseWaitlist({ email: "Ada@Example.com", intent: "both", city: "  Fargo ", zip: "58102" });
  assert.equal(withCity.ok, true);
  if (!withCity.ok) return;
  assert.equal(withCity.message, "You’re on the list — we’ll email when Fargo goes live.");
  assert.equal(withCity.message, waitlistSuccess("Fargo"));
  assert.equal(withCity.record.path, "waitlist");
  assert.equal(withCity.record.source, "site");
  assert.equal(withCity.record.email, "ada@example.com");
  assert.equal(withCity.record.intent, "both");
  assert.equal(withCity.record.city, "Fargo");
  assert.equal(withCity.record.zip, "58102");
  assert.equal(withCity.record.dedupe, "waitlist:ada@example.com");

  const zipOnly = parseWaitlist({ email: "ada@example.com", intent: "buyer", zip: "58102-1234" });
  assert.equal(zipOnly.ok, true);
  if (!zipOnly.ok) return;
  assert.equal(zipOnly.message, "You’re on the list — we’ll email when your area goes live.");
  assert.equal(zipOnly.record.city, null);
  assert.equal(zipOnly.record.zip, "58102-1234");
});

test("handoff requires the shop fields and an email or a phone", () => {
  const phoneOnly = parseHandoff({
    businessName: "North Coffee",
    contactName: "Ada Lovelace",
    city: "Fargo",
    storeType: "coffee",
    phone: "(701) 555-0199",
    whyUs: "Counter by the door",
  });
  assert.equal(phoneOnly.ok, true);
  if (!phoneOnly.ok) return;
  assert.equal(phoneOnly.message, "Thanks — we’ll be in touch about Official Handoff Location for Fargo.");
  assert.equal(phoneOnly.message, handoffSuccess("Fargo"));
  assert.equal(phoneOnly.record.path, "handoff_location");
  assert.equal(phoneOnly.record.source, "site");
  assert.equal(phoneOnly.record.email, null);
  assert.equal(phoneOnly.record.phone, "7015550199");
  assert.equal(phoneOnly.record.intent, null);
  assert.equal(phoneOnly.record.storeType, "coffee");
  assert.equal(phoneOnly.record.dedupe, "handoff:phone:7015550199");

  const emailOnly = parseHandoff({
    businessName: "North Coffee",
    contactName: "Ada Lovelace",
    city: "Fargo",
    storeType: "other",
    email: "Ada@Shop.example",
  });
  assert.equal(emailOnly.ok, true);
  if (!emailOnly.ok) return;
  assert.equal(emailOnly.record.email, "ada@shop.example");
  assert.equal(emailOnly.record.dedupe, "handoff:ada@shop.example");

  assert.equal(parseHandoff({ businessName: "North Coffee", contactName: "Ada", city: "Fargo", storeType: "gym" }).ok, false);
  assert.equal(
    parseHandoff({ businessName: "North Coffee", contactName: "Ada", city: "Fargo", storeType: "cafe", email: "a@b.co" }).ok,
    false,
  );
  assert.equal(
    parseHandoff({ businessName: "N", contactName: "Ada", city: "Fargo", storeType: "gym", email: "a@b.co" }).ok,
    false,
  );
});

test("launch csv keeps a stable header and empty fields for an old email-only row", () => {
  const oldRow: LaunchExportRow = {
    signed_up_at: "2026-09-01 12:00:00+00",
    path: null,
    email: "ada@example.com",
    phone: null,
    intent: null,
    city: null,
    zip: null,
    business_name: null,
    contact_name: null,
    store_type: null,
    why_us: null,
    hours: null,
    parking: null,
    source: null,
  };
  const fresh: LaunchExportRow = {
    signed_up_at: "2026-09-30 15:00:00+00",
    path: "handoff_location",
    email: "shop@example.com",
    phone: "7015550199",
    intent: null,
    city: "Fargo",
    zip: null,
    business_name: "North, Coffee",
    contact_name: 'Ada "N" Lovelace',
    store_type: "coffee",
    why_us: "Door\ncounter",
    hours: "8-4",
    parking: "Lot behind",
    source: "site",
  };
  const csv = launchSignupCsv([oldRow, fresh]);
  const lines = csv.split("\n");
  assert.equal(lines[0], LAUNCH_CSV_HEADER);
  assert.equal(
    lines[0],
    "signed_up_at,path,email,phone,intent,city,zip,business_name,contact_name,store_type,why_us,hours,parking,source",
  );
  assert.equal(lines[1], "2026-09-01 12:00:00+00,waitlist,ada@example.com,,,,,,,,,,,");
  assert.equal(lines[2]?.startsWith("2026-09-30 15:00:00+00,handoff_location,shop@example.com,7015550199,,Fargo,,"), true);
  assert.match(csv, /"North, Coffee"/);
  assert.match(csv, /"Ada ""N"" Lovelace"/);
  assert.match(csv, /"Door\ncounter"/);
  assert.match(csv, /,site\n$/);
});

test("email-only rows survive migration and a later handoff row can share the address", async () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const pg = new PGlite();
  await pg.waitReady;
  try {
    await pg.exec(readFileSync(join(root, "migrations/0049_launch_signups.sql"), "utf8"));
    await pg.exec(`insert into launch_signups (id, email) values ('old-1', 'ada@example.com')`);
    await pg.exec(readFileSync(join(root, "migrations/0051_launch_signup_capture.sql"), "utf8"));
    await pg.exec(`
      insert into launch_signups (
        id, email, phone, path, intent, city, business_name, contact_name, store_type, source, dedupe
      ) values
        ('w-new', 'bee@example.com', null, 'waitlist', 'seller', 'Fargo', null, null, null, 'site', 'waitlist:bee@example.com'),
        ('h-phone', null, '7015550199', 'handoff_location', null, 'Fargo', 'North Coffee', 'Ada Lovelace', 'coffee', 'site', 'handoff:phone:7015550199'),
        ('h-ada', 'ada@example.com', null, 'handoff_location', null, 'Fargo', 'North Coffee', 'Ada Lovelace', 'retail', 'site', 'handoff:ada@example.com')
    `);
    const listed = await pg.query<LaunchExportRow>(`
      select created_at::text as signed_up_at, path, email, phone, intent, city, zip,
        business_name, contact_name, store_type, why_us, hours, parking, source
      from launch_signups
      order by created_at, id
    `);
    const csv = launchSignupCsv(listed.rows);
    assert.match(csv, /,waitlist,ada@example.com,,,,,,,,,,,/);
    assert.match(csv, /,waitlist,bee@example.com,,seller,Fargo,,,,,,,,site/);
    assert.match(csv, /,handoff_location,,7015550199,,Fargo,,North Coffee,Ada Lovelace,coffee,,,,site/);
    assert.match(csv, /,handoff_location,ada@example.com,,,Fargo,,North Coffee,Ada Lovelace,retail,,,,site/);
    const legacy = listed.rows.find((row) => row.email === "ada@example.com" && row.path === "waitlist");
    assert.equal(legacy?.intent, null);
    assert.equal(legacy?.city, null);
    assert.equal(legacy?.source, null);
    assert.equal(listed.rows.filter((row) => row.email === "ada@example.com").length, 2);
  } finally {
    await pg.close();
  }
});

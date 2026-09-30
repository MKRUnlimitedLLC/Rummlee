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
  ownershipSuccess,
  parseHandoff,
  parseOwnership,
  parseWaitlist,
  waitlistSuccess,
  type LaunchExportRow,
} from "./launch-capture.ts";
import { mergeUtm, parseUtmSearch, sourceForUtm } from "./utm.ts";

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
  assert.equal(
    parseWaitlist({ email: "ada@example.com", intent: "buyer", city: "Fargo" })
      .ok,
    true,
  );
  assert.equal(
    parseWaitlist({ email: "ada@example.com", intent: "seller", zip: "58102" })
      .ok,
    true,
  );
  assert.equal(
    parseWaitlist({ email: "", intent: "buyer", city: "Fargo" }).ok,
    false,
  );
  assert.equal(
    parseWaitlist({ email: "ada@example.com", intent: "", city: "Fargo" }).ok,
    false,
  );
  assert.equal(
    parseWaitlist({ email: "ada@example.com", intent: "buyer" }).ok,
    false,
  );
  assert.equal(
    parseWaitlist({ email: "ada@example.com", intent: "buyer", zip: "12" }).ok,
    false,
  );
});

test("waitlist success covers updates and launch, and names the city when one was given", () => {
  const withCity = parseWaitlist({
    email: "Ada@Example.com",
    intent: "both",
    city: "  Fargo ",
    zip: "58102",
  });
  assert.equal(withCity.ok, true);
  if (!withCity.ok) return;
  assert.equal(
    withCity.message,
    "You’re on the list — we’ll email product updates, when Rummlee officially launches, and when Fargo opens.",
  );
  assert.equal(withCity.message, waitlistSuccess("Fargo"));
  assert.equal(withCity.record.path, "waitlist");
  assert.equal(withCity.record.source, "site");
  assert.equal(withCity.record.email, "ada@example.com");
  assert.equal(withCity.record.intent, "both");
  assert.equal(withCity.record.city, "Fargo");
  assert.equal(withCity.record.zip, "58102");
  assert.equal(withCity.record.dedupe, "waitlist:ada@example.com");

  const zipOnly = parseWaitlist({
    email: "ada@example.com",
    intent: "buyer",
    zip: "58102-1234",
  });
  assert.equal(zipOnly.ok, true);
  if (!zipOnly.ok) return;
  assert.equal(
    zipOnly.message,
    "You’re on the list — we’ll email product updates and when Rummlee officially launches.",
  );
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
  assert.equal(
    phoneOnly.message,
    "Thanks — we’ll be in touch about Official Handoff Location for Fargo.",
  );
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

  assert.equal(
    parseHandoff({
      businessName: "North Coffee",
      contactName: "Ada",
      city: "Fargo",
      storeType: "gym",
    }).ok,
    false,
  );
  assert.equal(
    parseHandoff({
      businessName: "North Coffee",
      contactName: "Ada",
      city: "Fargo",
      storeType: "cafe",
      email: "a@b.co",
    }).ok,
    false,
  );
  assert.equal(
    parseHandoff({
      businessName: "N",
      contactName: "Ada",
      city: "Fargo",
      storeType: "gym",
      email: "a@b.co",
    }).ok,
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
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
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
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
  };
  const csv = launchSignupCsv([oldRow, fresh]);
  const lines = csv.split("\n");
  assert.equal(lines[0], LAUNCH_CSV_HEADER);
  assert.equal(
    lines[0],
    "signed_up_at,path,email,phone,intent,city,zip,business_name,contact_name,store_type,why_us,hours,parking,source,utm_source,utm_medium,utm_campaign,utm_content,utm_term",
  );
  assert.equal(
    lines[1],
    "2026-09-01 12:00:00+00,waitlist,ada@example.com,,,,,,,,,,,,,,,,",
  );
  assert.equal(
    lines[2]?.startsWith(
      "2026-09-30 15:00:00+00,handoff_location,shop@example.com,7015550199,,Fargo,,",
    ),
    true,
  );
  assert.match(csv, /"North, Coffee"/);
  assert.match(csv, /"Ada ""N"" Lovelace"/);
  assert.match(csv, /"Door\ncounter"/);
  assert.match(csv, /,site,,,,,\n$/);
});

test("ownership interest is a separate path and does not require a phone or address", () => {
  const parsed = parseOwnership({
    email: "Ada@Firm.example",
    businessName: "  Acme Holdings ",
    whyUs: "Local retail",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.message, ownershipSuccess());
  assert.equal(
    parsed.message,
    "Thanks — we’ll read it. This is interest only. It is not an offer, an allocation, or a closing date.",
  );
  assert.equal(parsed.record.path, "ownership_interest");
  assert.notEqual(parsed.record.path, "handoff_location");
  assert.equal(parsed.record.source, "site");
  assert.equal(parsed.record.email, "ada@firm.example");
  assert.equal(parsed.record.businessName, "Acme Holdings");
  assert.equal(parsed.record.whyUs, "Local retail");
  assert.equal(parsed.record.phone, null);
  assert.equal(parsed.record.city, null);
  assert.equal(parsed.record.zip, null);
  assert.equal(parsed.record.contactName, null);
  assert.equal(parsed.record.storeType, null);
  assert.equal(parsed.record.dedupe, "ownership:ada@firm.example");

  const noNote = parseOwnership({
    email: "ada@firm.example",
    businessName: "Acme",
  });
  assert.equal(noNote.ok, true);
  if (noNote.ok) assert.equal(noNote.record.whyUs, null);

  assert.equal(parseOwnership({ email: "", businessName: "Acme" }).ok, false);
  assert.equal(
    parseOwnership({ email: "ada@firm.example", businessName: "A" }).ok,
    false,
  );
  assert.equal(
    parseOwnership({ email: "not-an-email", businessName: "Acme" }).ok,
    false,
  );
  assert.equal(
    parseOwnership({
      email: "ada@firm.example",
      businessName: "Acme",
      whyUs: "x".repeat(281),
    }).ok,
    false,
  );
});

test("utm params attach on every path and source stays site unless utm_source is meta", () => {
  const fromSearch = parseUtmSearch(
    "?utm_source=newsletter&utm_medium=email&utm_campaign=sept&utm_content=hero&utm_term=equity&ref=ignore",
  );
  assert.deepEqual(fromSearch, {
    utmSource: "newsletter",
    utmMedium: "email",
    utmCampaign: "sept",
    utmContent: "hero",
    utmTerm: "equity",
  });
  assert.equal(sourceForUtm(fromSearch), "site");
  assert.equal(sourceForUtm(parseUtmSearch("?utm_source=Meta")), "meta");
  assert.equal(sourceForUtm(parseUtmSearch("?utm_source=facebook")), "site");
  assert.deepEqual(parseUtmSearch(""), {
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
  });
  const merged = mergeUtm(fromSearch, parseUtmSearch("?utm_campaign=oct"));
  assert.equal(merged.utmSource, "newsletter");
  assert.equal(merged.utmCampaign, "oct");

  const wait = parseWaitlist({
    email: "ada@example.com",
    intent: "buyer",
    city: "Fargo",
    utmSource: "newsletter",
    utmMedium: "email",
    utmCampaign: "x".repeat(200),
  });
  assert.equal(wait.ok, true);
  if (!wait.ok) return;
  assert.equal(wait.record.source, "site");
  assert.equal(wait.record.utmSource, "newsletter");
  assert.equal(wait.record.utmMedium, "email");
  assert.equal(wait.record.utmCampaign?.length, 120);
  assert.equal(wait.record.utmContent, null);

  const shop = parseHandoff({
    businessName: "North Coffee",
    contactName: "Ada Lovelace",
    city: "Fargo",
    storeType: "coffee",
    email: "ada@shop.example",
    utmSource: "Meta",
    utmMedium: "paid",
  });
  assert.equal(shop.ok, true);
  if (!shop.ok) return;
  assert.equal(shop.record.path, "handoff_location");
  assert.equal(shop.record.source, "meta");
  assert.equal(shop.record.utmSource, "Meta");

  const owner = parseOwnership({
    email: "ada@firm.example",
    businessName: "Acme, Holdings",
    whyUs: "A short note",
    utmSource: "meta",
    utmTerm: "equity",
  });
  assert.equal(owner.ok, true);
  if (!owner.ok) return;
  assert.equal(owner.record.path, "ownership_interest");
  assert.equal(owner.record.source, "meta");
  const csv = launchSignupCsv([
    {
      signed_up_at: "2026-09-30 16:00:00+00",
      path: owner.record.path,
      email: owner.record.email,
      phone: owner.record.phone,
      intent: owner.record.intent,
      city: owner.record.city,
      zip: owner.record.zip,
      business_name: owner.record.businessName,
      contact_name: owner.record.contactName,
      store_type: owner.record.storeType,
      why_us: owner.record.whyUs,
      hours: owner.record.hours,
      parking: owner.record.parking,
      source: owner.record.source,
      utm_source: owner.record.utmSource,
      utm_medium: owner.record.utmMedium,
      utm_campaign: owner.record.utmCampaign,
      utm_content: owner.record.utmContent,
      utm_term: owner.record.utmTerm,
    },
  ]);
  assert.equal(csv.split("\n")[0], LAUNCH_CSV_HEADER);
  assert.match(
    csv,
    /ownership_interest,ada@firm.example,,,,,"Acme, Holdings",,,A short note,,,meta,meta,,,,equity/,
  );
});

test("email-only rows survive migration and a later handoff row can share the address", async () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const pg = new PGlite();
  await pg.waitReady;
  try {
    await pg.exec(
      readFileSync(join(root, "migrations/0049_launch_signups.sql"), "utf8"),
    );
    await pg.exec(
      `insert into launch_signups (id, email) values ('old-1', 'ada@example.com')`,
    );
    await pg.exec(
      readFileSync(
        join(root, "migrations/0051_launch_signup_capture.sql"),
        "utf8",
      ),
    );
    await pg.exec(
      readFileSync(join(root, "migrations/0052_launch_signup_utm.sql"), "utf8"),
    );
    await pg.exec(`
      insert into launch_signups (
        id, email, phone, path, intent, city, business_name, contact_name, store_type, source, dedupe
      ) values
        ('w-new', 'bee@example.com', null, 'waitlist', 'seller', 'Fargo', null, null, null, 'site', 'waitlist:bee@example.com'),
        ('h-phone', null, '7015550199', 'handoff_location', null, 'Fargo', 'North Coffee', 'Ada Lovelace', 'coffee', 'site', 'handoff:phone:7015550199'),
        ('h-ada', 'ada@example.com', null, 'handoff_location', null, 'Fargo', 'North Coffee', 'Ada Lovelace', 'retail', 'site', 'handoff:ada@example.com'),
        ('own-1', 'ada@firm.example', null, 'ownership_interest', null, null, 'Acme Holdings', null, null, 'site', 'ownership:ada@firm.example')
    `);
    await pg.exec(`
      update launch_signups
      set why_us = 'Local retail', utm_source = 'newsletter', utm_medium = 'email', utm_campaign = 'sept'
      where id = 'own-1'
    `);
    const listed = await pg.query<LaunchExportRow>(`
      select created_at::text as signed_up_at, path, email, phone, intent, city, zip,
        business_name, contact_name, store_type, why_us, hours, parking, source,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term
      from launch_signups
      order by created_at, id
    `);
    const csv = launchSignupCsv(listed.rows);
    assert.match(csv, /,waitlist,ada@example.com,,,,,,,,,,,,,,,,/);
    assert.match(
      csv,
      /,waitlist,bee@example.com,,seller,Fargo,,,,,,,,site,,,,,/,
    );
    assert.match(
      csv,
      /,handoff_location,,7015550199,,Fargo,,North Coffee,Ada Lovelace,coffee,,,,site,,,,,/,
    );
    assert.match(
      csv,
      /,handoff_location,ada@example.com,,,Fargo,,North Coffee,Ada Lovelace,retail,,,,site,,,,,/,
    );
    assert.match(
      csv,
      /,ownership_interest,ada@firm.example,,,,,Acme Holdings,,,Local retail,,,site,newsletter,email,sept,,/,
    );
    const legacy = listed.rows.find(
      (row) => row.email === "ada@example.com" && row.path === "waitlist",
    );
    assert.equal(listed.rows.length, 5);
    assert.equal(legacy?.intent, null);
    assert.equal(legacy?.city, null);
    assert.equal(legacy?.source, null);
    assert.equal(legacy?.utm_source, null);
    assert.equal(legacy?.utm_campaign, null);
    assert.equal(
      listed.rows.filter((row) => row.email === "ada@example.com").length,
      2,
    );
  } finally {
    await pg.close();
  }
});

import { normalizeLaunchEmail } from "./launch-email.ts";
import { readUtm, sourceForUtm, type UtmFields } from "./utm.ts";

export const LAUNCH_SOURCE = "site" as const;

export const INTENT_OPTIONS = [
  {
    value: "buyer",
    name: "Buyer",
    label: "Notify me when listings go live near me",
  },
  { value: "seller", name: "Seller", label: "Notify me when I can list" },
  { value: "both", name: "Both", label: "Buyer and seller" },
] as const;

export const STORE_TYPES = [
  { value: "coffee", label: "Coffee" },
  { value: "thrift", label: "Thrift" },
  { value: "gym", label: "Gym" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
] as const;

export const LAUNCH_CSV_COLUMNS = [
  "signed_up_at",
  "path",
  "email",
  "phone",
  "intent",
  "city",
  "zip",
  "business_name",
  "contact_name",
  "store_type",
  "why_us",
  "hours",
  "parking",
  "source",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type LaunchIntent = (typeof INTENT_OPTIONS)[number]["value"];
export type StoreType = (typeof STORE_TYPES)[number]["value"];
export type LaunchPath = "waitlist" | "handoff_location" | "ownership_interest";
export const OWNERSHIP_NOTE_MAX = 280;

export type LaunchRecord = {
  path: LaunchPath;
  email: string | null;
  phone: string | null;
  intent: LaunchIntent | null;
  city: string | null;
  zip: string | null;
  businessName: string | null;
  contactName: string | null;
  storeType: StoreType | null;
  whyUs: string | null;
  hours: string | null;
  parking: string | null;
  source: "site" | "meta";
  dedupe: string;
} & UtmFields;

export type LaunchExportRow = {
  signed_up_at: string;
  path: string | null;
  email: string | null;
  phone: string | null;
  intent: string | null;
  city: string | null;
  zip: string | null;
  business_name: string | null;
  contact_name: string | null;
  store_type: string | null;
  why_us: string | null;
  hours: string | null;
  parking: string | null;
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
};

type Parsed =
  | { ok: true; record: LaunchRecord; message: string }
  | { ok: false; error: string };

const STORE_TYPE_SET = new Set<string>(STORE_TYPES.map((item) => item.value));

export function waitlistSuccess(city: string | null): string {
  if (city)
    return `You’re on the list — we’ll email product updates, when Rummlee officially launches, and when ${city} opens.`;
  return "You’re on the list — we’ll email product updates and when Rummlee officially launches.";
}

export function ownershipSuccess(): string {
  return "Thanks — we’ll read it. This is interest only. It is not an offer, an allocation, or a closing date.";
}

export function handoffSuccess(city: string): string {
  return `Thanks — we’ll be in touch about Official Handoff Location for ${city}.`;
}

function collapse(raw: string | null | undefined) {
  return (raw ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readEmail(
  raw: string | null | undefined,
): { ok: true; email: string | null } | { ok: false; error: string } {
  const text = (raw ?? "").trim();
  if (!text) return { ok: true, email: null };
  const email = normalizeLaunchEmail(text);
  if (!email) return { ok: false, error: "Enter a real email address." };
  return { ok: true, email };
}

function readZip(
  raw: string | null | undefined,
): { ok: true; zip: string | null } | { ok: false; error: string } {
  const text = (raw ?? "").trim();
  if (!text) return { ok: true, zip: null };
  if (!/^\d{5}(?:-\d{4})?$/.test(text))
    return { ok: false, error: "Enter a 5-digit ZIP." };
  return { ok: true, zip: text };
}

function readCity(
  raw: string | null | undefined,
): { ok: true; city: string | null } | { ok: false; error: string } {
  const city = collapse(raw);
  if (!city) return { ok: true, city: null };
  if (city.length < 2 || city.length > 80 || !/[A-Za-z]/.test(city))
    return { ok: false, error: "Add the city." };
  return { ok: true, city };
}

function readPhone(
  raw: string | null | undefined,
): { ok: true; phone: string | null } | { ok: false; error: string } {
  const text = (raw ?? "").trim();
  if (!text) return { ok: true, phone: null };
  const digits = text.replace(/\D/g, "");
  const phone =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (phone.length < 10 || phone.length > 15)
    return {
      ok: false,
      error: "Enter a phone number with at least 10 digits.",
    };
  return { ok: true, phone };
}

function readName(raw: string | null | undefined, empty: string) {
  const text = collapse(raw);
  if (text.length < 2 || text.length > 120)
    return { ok: false as const, error: empty };
  return { ok: true as const, text };
}

function readNote(raw: string | null | undefined, max: number) {
  const text = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return { ok: true as const, text: null };
  if (text.length > max)
    return { ok: false as const, error: "Keep that note shorter." };
  return { ok: true as const, text };
}

function campaign(input: Partial<UtmFields>) {
  const utm = readUtm(input);
  return { utm, source: sourceForUtm(utm) };
}

export function parseWaitlist(
  input: {
    email?: string | null;
    intent?: string | null;
    city?: string | null;
    zip?: string | null;
  } & Partial<UtmFields>,
): Parsed {
  const email = readEmail(input.email);
  if (!email.ok) return email;
  if (!email.email) return { ok: false, error: "Enter a real email address." };
  const intent = INTENT_OPTIONS.find(
    (item) => item.value === input.intent,
  )?.value;
  if (!intent) return { ok: false, error: "Pick buyer, seller, or both." };
  const city = readCity(input.city);
  if (!city.ok) return city;
  const zip = readZip(input.zip);
  if (!zip.ok) return zip;
  if (!city.city && !zip.zip)
    return { ok: false, error: "Add a city or a ZIP." };
  const paid = campaign(input);
  const record: LaunchRecord = {
    path: "waitlist",
    email: email.email,
    phone: null,
    intent,
    city: city.city,
    zip: zip.zip,
    businessName: null,
    contactName: null,
    storeType: null,
    whyUs: null,
    hours: null,
    parking: null,
    source: paid.source,
    dedupe: `waitlist:${email.email}`,
    ...paid.utm,
  };
  return { ok: true, record, message: waitlistSuccess(city.city) };
}

export function parseHandoff(
  input: {
    businessName?: string | null;
    contactName?: string | null;
    city?: string | null;
    zip?: string | null;
    storeType?: string | null;
    email?: string | null;
    phone?: string | null;
    whyUs?: string | null;
    hours?: string | null;
    parking?: string | null;
  } & Partial<UtmFields>,
): Parsed {
  const business = readName(input.businessName, "Add the business name.");
  if (!business.ok) return business;
  const contact = readName(input.contactName, "Add a contact name.");
  if (!contact.ok) return contact;
  const city = readCity(input.city);
  if (!city.ok) return city;
  if (!city.city) return { ok: false, error: "Add the city." };
  const zip = readZip(input.zip);
  if (!zip.ok) return zip;
  const storeType = (input.storeType ?? "").trim();
  if (!STORE_TYPE_SET.has(storeType))
    return { ok: false, error: "Pick a store type." };
  const email = readEmail(input.email);
  if (!email.ok) return email;
  const phone = readPhone(input.phone);
  if (!phone.ok) return phone;
  if (!email.email && !phone.phone)
    return { ok: false, error: "Add an email or a phone number." };
  const whyUs = readNote(input.whyUs, 500);
  if (!whyUs.ok) return whyUs;
  const hours = readNote(input.hours, 160);
  if (!hours.ok) return hours;
  const parking = readNote(input.parking, 160);
  if (!parking.ok) return parking;
  const paid = campaign(input);
  const record: LaunchRecord = {
    path: "handoff_location",
    email: email.email,
    phone: phone.phone,
    intent: null,
    city: city.city,
    zip: zip.zip,
    businessName: business.text,
    contactName: contact.text,
    storeType: storeType as StoreType,
    whyUs: whyUs.text,
    hours: hours.text,
    parking: parking.text,
    source: paid.source,
    dedupe: email.email
      ? `handoff:${email.email}`
      : `handoff:phone:${phone.phone}`,
    ...paid.utm,
  };
  return { ok: true, record, message: handoffSuccess(city.city) };
}

export function parseOwnership(
  input: {
    email?: string | null;
    businessName?: string | null;
    whyUs?: string | null;
  } & Partial<UtmFields>,
): Parsed {
  const email = readEmail(input.email);
  if (!email.ok) return email;
  if (!email.email) return { ok: false, error: "Enter a real email address." };
  const company = readName(input.businessName, "Add the company name.");
  if (!company.ok) return company;
  const note = readNote(input.whyUs, OWNERSHIP_NOTE_MAX);
  if (!note.ok) return note;
  const paid = campaign(input);
  const record: LaunchRecord = {
    path: "ownership_interest",
    email: email.email,
    phone: null,
    intent: null,
    city: null,
    zip: null,
    businessName: company.text,
    contactName: null,
    storeType: null,
    whyUs: note.text,
    hours: null,
    parking: null,
    source: paid.source,
    dedupe: `ownership:${email.email}`,
    ...paid.utm,
  };
  return { ok: true, record, message: ownershipSuccess() };
}

function csvCell(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function exportCell(
  row: LaunchExportRow,
  key: (typeof LAUNCH_CSV_COLUMNS)[number],
) {
  if (key === "path") {
    const path = (row.path ?? "").trim();
    return path || "waitlist";
  }
  const value = row[key];
  return value == null ? "" : String(value);
}

export function launchSignupCsv(rows: LaunchExportRow[]) {
  const lines = [LAUNCH_CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(
      LAUNCH_CSV_COLUMNS.map((key) => csvCell(exportCell(row, key))).join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export const LAUNCH_CSV_HEADER = LAUNCH_CSV_COLUMNS.join(",");

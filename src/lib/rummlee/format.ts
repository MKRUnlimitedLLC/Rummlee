import { CATEGORIES, HANDLE_ADJ, HANDLE_NOUN, HAULS, HANDOFF_MODES, HOLD_LINE } from "./constants";
import { checkoutQuote, DEFAULT_FEES } from "./fees";
import type { HandoffMode, SpotKind } from "./types";

export function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function feeOn(amountCents: number, premium: boolean) {
  return checkoutQuote(DEFAULT_FEES, amountCents, premium, "official").buyerFeeCents;
}

/** Agreed offer price when one is open; otherwise the listing's asking price. */
export function payBaseCents(
  askingCents: number,
  offer?: { status: string; amountCents: number; counterCents: number | null } | null,
) {
  if (offer?.status === "accepted") return offer.counterCents ?? offer.amountCents;
  if (offer?.status === "countered" && offer.counterCents != null) return offer.counterCents;
  return askingCents;
}

export function offerHeadline(status: string) {
  if (status === "pending") return "Waiting on them";
  if (status === "countered") return "They sent a counteroffer";
  if (status === "accepted") return "They said yes";
  if (status === "declined") return "They declined";
  return "Offer";
}

export function agreedOfferCents(offer: { amountCents: number; counterCents: number | null; status: string }) {
  if (offer.status === "countered" && offer.counterCents != null) return offer.counterCents;
  return offer.amountCents;
}

/** One base. Buyer fee comes from the fee table (defaults until the live table loads). */
export function payQuote(baseCents: number, premium: boolean) {
  const quote = checkoutQuote(DEFAULT_FEES, baseCents, premium, "official");
  return { baseCents, feeCents: quote.buyerFeeCents + quote.handoffFeeCents, youPayCents: quote.youPayCents };
}

export function saleWindow(startsOn: string, endsOn: string) {
  const a = parseDay(startsOn);
  const b = parseDay(endsOn);
  const same = startsOn === endsOn;
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  if (same) return a.toLocaleDateString("en-US", opts);
  return `${a.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${b.toLocaleDateString("en-US", opts)}`;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function dowName(dow: number) {
  return DOW[((dow % 7) + 7) % 7];
}

export function dowSpan(start: number, end: number) {
  if (start === end) return dowName(start);
  return `${dowName(start)}–${dowName(end)}`;
}

/** 09:00 → 9am, 15:30 → 3:30pm. */
export function clockLabel(value: string | null | undefined) {
  if (!value) return "";
  const [hRaw, mRaw] = value.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw ?? 0);
  if (!Number.isFinite(h)) return value;
  const hour = h % 12 || 12;
  const ap = h < 12 ? "am" : "pm";
  if (!m) return `${hour}${ap}`;
  return `${hour}:${String(m).padStart(2, "0")}${ap}`;
}

export type WindowFields = {
  onlineStartDow?: number | null;
  onlineEndDow?: number | null;
  liveOn?: boolean;
  liveStartDow?: number | null;
  liveEndDow?: number | null;
  liveOpen?: string | null;
  liveClose?: string | null;
};

export function onlineWindowLine(row: WindowFields) {
  if (row.onlineStartDow == null || row.onlineEndDow == null) return null;
  return `Online ${dowSpan(row.onlineStartDow, row.onlineEndDow)} · Offers open`;
}

export function liveWindowLine(row: WindowFields) {
  if (!row.liveOn || row.liveStartDow == null || row.liveEndDow == null) return null;
  const hours =
    row.liveOpen && row.liveClose ? ` · ${clockLabel(row.liveOpen)}–${clockLabel(row.liveClose)}` : "";
  return `In person ${dowSpan(row.liveStartDow, row.liveEndDow)}${hours}`;
}

export function parseDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function categoryLabel(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function haulLabel(id: string) {
  return HAULS.find((h) => h.id === id)?.label ?? id;
}

export function handoffLabel(id: HandoffMode | string) {
  return HANDOFF_MODES.find((h) => h.id === id)?.label ?? id;
}

export function parseSpotKind(raw: string | null | undefined): SpotKind | null {
  if (raw === "partner" || raw === "public") return raw;
  return null;
}

export function spotKindLabel(kind: SpotKind | string | null | undefined) {
  if (kind === "partner") return "Official store handoff";
  if (kind === "public") return "Public place handoff";
  return "Handoff location";
}

export function cityOf(neighborhood: string) {
  const i = neighborhood.lastIndexOf(",");
  return i === -1 ? neighborhood : neighborhood.slice(i + 1).trim();
}

export function placeName(neighborhood: string) {
  const i = neighborhood.lastIndexOf(",");
  return i === -1 ? neighborhood : neighborhood.slice(0, i).trim();
}

export { HOLD_LINE };

export function canonicalizeMode(raw: string | null | undefined): HandoffMode | null {
  const id = (raw ?? "").trim();
  if (id === "official" || id === "public" || id === "person") return id;
  if (id === "porch" || id === "p2p") return "person";
  return null;
}

const MODE_ORDER: HandoffMode[] = ["official", "public", "person"];

export function splitModes(raw: string | null | undefined): HandoffMode[] {
  const modes = (raw ?? "official")
    .split(",")
    .map((s) => canonicalizeMode(s))
    .filter((s): s is HandoffMode => Boolean(s));
  const unique = [...new Set(modes.length ? modes : (["official"] as HandoffMode[]))];
  return unique.sort((a, b) => MODE_ORDER.indexOf(a) - MODE_ORDER.indexOf(b));
}

export function makeHandle() {
  const a = HANDLE_ADJ[Math.floor(Math.random() * HANDLE_ADJ.length)];
  const n = HANDLE_NOUN[Math.floor(Math.random() * HANDLE_NOUN.length)];
  const num = Math.floor(10 + Math.random() * 89);
  return `${a}_${n}_${num}`;
}

/** A public handle. Not an email, not a real name field. */
export function normalizeHandle(raw: string) {
  const handle = raw.trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z][a-z0-9_]{2,22}$/.test(handle)) {
    throw new Error("Use 3–23 letters, numbers, or underscores. Start with a letter.");
  }
  return handle;
}

/** Old accounts stored an email fragment as the handle. Neighbors should never see that. */
export function looksLikeAccountLabel(handle: string) {
  return /[.@\s]/.test(handle);
}

export function nextSaturdayIso() {
  const d = new Date();
  const add = (6 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + add);
  return toIsoDay(d);
}

export function toIsoDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysIso(iso: string, days: number) {
  const d = parseDay(iso);
  d.setDate(d.getDate() + days);
  return toIsoDay(d);
}

export function pickupCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${out.slice(0, 3)}-${out.slice(3)}`;
}

export function partyScan(side: "S" | "B") {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = side;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export function isSeedUser(id: string) {
  return id.startsWith("seed-");
}

export function packLabel(pack: string | null | undefined) {
  if (pack === "box") return "Outer box";
  if (pack === "as_is") return "As is";
  return null;
}

/** Official store counters are for a boxed item at 50 lb or under. */
export const COUNTER_MAX_LBS = 50;

export function fitsOfficialCounter(input: { pack?: string | null; weightLbs?: number | null; haul?: string | null }) {
  if (input.pack === "as_is") return false;
  if (input.haul === "truck") return false;
  if (input.weightLbs != null && input.weightLbs > COUNTER_MAX_LBS) return false;
  return true;
}

export const PERSON_ONLY_LINE =
  "In person only. Over 50 lb, not in a box, or needs a truck. The seller arranges pickup, or the buyer can offer delivery.";

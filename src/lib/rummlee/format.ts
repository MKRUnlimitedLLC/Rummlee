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

export function isSeedUser(id: string) {
  return id.startsWith("seed-");
}

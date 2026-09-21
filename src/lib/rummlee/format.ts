import { CATEGORIES, HANDLE_ADJ, HANDLE_NOUN, HAULS, HANDOFF_MODES } from "./constants";
import type { HandoffMode, SpotKind } from "./types";

export function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function feeOn(amountCents: number, premium: boolean) {
  const rate = premium ? 0.05 : 0.1;
  return Math.round(amountCents * rate);
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
  if (kind === "partner") return "Partner store";
  if (kind === "public") return "Public place";
  return "Handoff";
}

export function cityOf(neighborhood: string) {
  const i = neighborhood.lastIndexOf(",");
  return i === -1 ? neighborhood : neighborhood.slice(i + 1).trim();
}

export function placeName(neighborhood: string) {
  const i = neighborhood.lastIndexOf(",");
  return i === -1 ? neighborhood : neighborhood.slice(0, i).trim();
}

export function splitModes(raw: string | null | undefined): HandoffMode[] {
  const modes = (raw ?? "official")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is HandoffMode => s === "porch" || s === "official");
  const unique = [...new Set(modes.length ? modes : (["official"] as HandoffMode[]))];
  return unique.sort((a, b) => Number(b === "official") - Number(a === "official"));
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

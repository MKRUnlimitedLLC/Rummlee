import type { HandoffMode } from "./types";

const DRAFT_KEY = "rummlee.listingDraft.v1";
const AFTER_LOGIN_KEY = "rummlee.afterLogin";

export type DraftLine = {
  id: string;
  title: string;
  price: string;
  description: string;
  category: string;
  condition: string;
  haul: string;
  photoUrl: string;
};

export type ListingDraft = {
  kind: "garage" | "moving" | "clearout";
  neighborhood: string;
  modes: HandoffMode[];
  handoffSpotId: string;
  lines: DraftLine[];
};

export function blankLine(partial?: Partial<DraftLine>): DraftLine {
  return {
    id: crypto.randomUUID(),
    title: "",
    price: "",
    description: "",
    category: "furniture",
    condition: "Good",
    haul: "one",
    photoUrl: "",
    ...partial,
  };
}

export function loadDraft(): ListingDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ListingDraft;
    if (!parsed || !Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(draft: ListingDraft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* private mode */
  }
}

/** One item per line. A trailing price is optional: "Sofa, 80" or "Desk 45". */
export function parsePasteList(text: string): { title: string; price: string }[] {
  const rows: { title: string; price: string }[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const matched = line.match(/^(.*?)(?:[,–—]|\s)\s*\$?\s*(\d+(?:\.\d{1,2})?)\s*$/);
    if (matched?.[1]?.trim()) {
      rows.push({
        title: matched[1].trim().replace(/[,–—-]\s*$/, ""),
        price: matched[2] ?? "",
      });
    } else {
      rows.push({ title: line, price: "" });
    }
    if (rows.length >= 12) break;
  }
  return rows;
}

function safePath(path: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("://")) return "/";
  return path;
}

export function rememberAfterLogin(path: string) {
  try {
    sessionStorage.setItem(AFTER_LOGIN_KEY, safePath(path));
  } catch {
    /* ignore */
  }
}

export function peekAfterLogin() {
  try {
    return safePath(sessionStorage.getItem(AFTER_LOGIN_KEY));
  } catch {
    return "/";
  }
}

export function takeAfterLogin() {
  const path = peekAfterLogin();
  try {
    sessionStorage.removeItem(AFTER_LOGIN_KEY);
  } catch {
    /* ignore */
  }
  return path;
}

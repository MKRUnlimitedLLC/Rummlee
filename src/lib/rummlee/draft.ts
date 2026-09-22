import { PASTE_CAP } from "./constants";
import { nextSaturdayIso, splitModes } from "./format";
import type { HandoffMode } from "./types";

const DRAFT_KEY = "rummlee.listingDraft.v1";
const AFTER_LOGIN_KEY = "rummlee.afterLogin";
const LAST_CITY_KEY = "rummlee.lastCity";

export type DraftLine = {
  id: string;
  title: string;
  price: string;
  floor: string;
  description: string;
  category: string;
  condition: string;
  haul: string;
  sizeLabel: string;
  photoUrl: string;
};

export type ListingDraft = {
  saleId?: string;
  kind: "garage" | "moving" | "clearout";
  neighborhood: string;
  modes: HandoffMode[];
  handoffSpotId: string;
  startsOn: string;
  endsOn: string;
  channel: "online" | "physical" | "both";
  physicalLocation: string;
  hoursStart: string;
  hoursEnd: string;
  lines: DraftLine[];
};

export type SellPreset = {
  id: string;
  label: string;
  kind: ListingDraft["kind"];
  modes: HandoffMode[];
  sample: string;
  hint: string;
  category: string;
  haul: string;
};

export const SELL_PRESETS: SellPreset[] = [
  {
    id: "kitchen",
    label: "Kitchen clearout",
    kind: "clearout",
    modes: ["official", "person"],
    category: "kitchen",
    haul: "bag",
    hint: "Official store + in person. Paste mixer, pans, plates.",
    sample: "Stand mixer · 95\nTwo-slice toaster · 12\nDinner plates, set of 4 · 20",
  },
  {
    id: "building",
    label: "Building / common area",
    kind: "moving",
    modes: ["official"],
    category: "furniture",
    haul: "two",
    hint: "Official store only. Add lobby or elevator rules in the note.",
    sample: "Lobby sofa · 120\nConsole table · 80",
  },
  {
    id: "garage",
    label: "Garage / tools",
    kind: "garage",
    modes: ["official"],
    category: "outdoor",
    haul: "one",
    hint: "Official store is the default. In person is optional — off is not a bug.",
    sample: "Extension ladder · 55\nRolling tool chest · 140",
  },
  {
    id: "moving",
    label: "Moving furniture",
    kind: "moving",
    modes: ["official", "public"],
    category: "furniture",
    haul: "two",
    hint: "One handoff plan, several big pieces.",
    sample: "Cream sofa · 90\nWhite desk · 120\nSix-drawer dresser · 180",
  },
];

export function blankLine(partial?: Partial<DraftLine>): DraftLine {
  return {
    id: crypto.randomUUID(),
    title: "",
    price: "",
    floor: "",
    description: "",
    category: "furniture",
    condition: "Good",
    haul: "one",
    sizeLabel: "",
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
    return {
      ...parsed,
      modes: splitModes((parsed.modes ?? ["official"]).join(",")),
      startsOn: parsed.startsOn || nextSaturdayIso(),
      endsOn: parsed.endsOn || parsed.startsOn || nextSaturdayIso(),
      channel: parsed.channel === "physical" || parsed.channel === "both" ? parsed.channel : "online",
      physicalLocation: parsed.physicalLocation ?? "",
      hoursStart: parsed.hoursStart || "08:00",
      hoursEnd: parsed.hoursEnd || "14:00",
      lines: parsed.lines.map((line) => ({
        ...blankLine(),
        ...line,
        floor: line.floor ?? "",
      })),
    };
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

/** One item per line. Optional: title · size · price  or  title, 80 */
export function parsePasteList(text: string): { title: string; price: string; sizeLabel: string }[] {
  const rows: { title: string; price: string; sizeLabel: string }[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const dotted = line.split(/\s*·\s*/).map((part) => part.trim()).filter(Boolean);
    if (dotted.length >= 3) {
      const pricePart = dotted[dotted.length - 1].replace(/^\$/, "");
      const sizePart = dotted[dotted.length - 2];
      const title = dotted.slice(0, -2).join(" · ");
      if (title && /^\d+(?:\.\d{1,2})?$/.test(pricePart)) {
        rows.push({ title, price: pricePart, sizeLabel: sizePart });
        if (rows.length >= PASTE_CAP) break;
        continue;
      }
    }
    if (dotted.length === 2 && /^\d+(?:\.\d{1,2})?$/.test(dotted[1].replace(/^\$/, ""))) {
      rows.push({ title: dotted[0], price: dotted[1].replace(/^\$/, ""), sizeLabel: "" });
      if (rows.length >= PASTE_CAP) break;
      continue;
    }
    const matched = line.match(/^(.*?)(?:[,–—]|\s)\s*\$?\s*(\d+(?:\.\d{1,2})?)\s*$/);
    if (matched?.[1]?.trim()) {
      rows.push({
        title: matched[1].trim().replace(/[,–—-]\s*$/, ""),
        price: matched[2] ?? "",
        sizeLabel: "",
      });
    } else {
      rows.push({ title: line, price: "", sizeLabel: "" });
    }
    if (rows.length >= PASTE_CAP) break;
  }
  return rows;
}

export function guessCategory(title: string, fallback = "furniture") {
  const t = title.toLowerCase();
  if (/mixer|toaster|blender|microwave|coffee|air.?fry|pan|plate|pot|kettle|knife|gadget/.test(t)) return "kitchen";
  if (/sweater|crewneck|cashmere|merino|jacket|jeans|dress|tee|coat/.test(t)) return "clothing";
  if (/\bbike\b|stroller|play kitchen|kids|toy|crib/.test(t)) return "kids";
  if (/ladder|tool|chest|trailer|drill|saw/.test(t)) return "outdoor";
  if (/sofa|desk|dresser|chair|table|console/.test(t)) return "furniture";
  return fallback;
}

export function guessHaul(category: string, title: string, fallback = "one") {
  const t = title.toLowerCase();
  if (/ladder|trailer|dresser|sofa|chest/.test(t) || category === "furniture") return /desk|chair/.test(t) ? "one" : "two";
  if (category === "kitchen" || category === "clothing" || category === "beauty") {
    return /mixer|microwave|blender/.test(t) ? "one" : "bag";
  }
  if (category === "outdoor") return /ladder|trailer/.test(t) ? "truck" : "one";
  return fallback;
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

export function rememberCity(city: string) {
  try {
    sessionStorage.setItem(LAST_CITY_KEY, city);
  } catch {
    /* ignore */
  }
}

export function lastCity() {
  try {
    return sessionStorage.getItem(LAST_CITY_KEY) ?? "all";
  } catch {
    return "all";
  }
}

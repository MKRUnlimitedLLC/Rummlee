/** First-party choice cookie. Essential. Not an ad cookie. */
export const CONSENT_COOKIE = "rummlee_consent";
export const CONSENT_MAX_AGE = 15_552_000;

export const MEASURE_EVENTS = ["page_view", "launch_signup", "handoff_apply", "investor_signup"] as const;
export type MeasureEvent = (typeof MEASURE_EVENTS)[number];

export type ConsentChoice = "essential" | "all";

/** Runs before any tag. Ads and analytics stay denied until the visitor allows measurement. */
export const CONSENT_BOOT =
  "(function(){window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};window.gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});})();";

const GA = /^G-[A-Z0-9]{4,}$/;
const ADS = /^AW-\d{6,}$/;
const SEND_TO = /^AW-\d{6,}\/[A-Za-z0-9_-]{4,}$/;
const UTM_KEY = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

export function googleIds(ga: string | undefined, ads: string | undefined): string[] {
  const ids: string[] = [];
  const measurement = ga?.trim();
  const account = ads?.trim();
  if (measurement && GA.test(measurement)) ids.push(measurement);
  if (account && ADS.test(account)) ids.push(account);
  return ids;
}

export function gtagScriptUrl(id: string): string | null {
  if (!GA.test(id) && !ADS.test(id)) return null;
  return `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
}

export function adsSendTo(raw: string | undefined): string | null {
  const value = raw?.trim();
  return value && SEND_TO.test(value) ? value : null;
}

/** Meta pixel ids are 15 or 16 digits. Empty or anything else leaves the pixel off. */
const META_PIXEL_ID = /^\d{15,16}$/;

export const META_PIXEL_SRC = "https://connect.facebook.net/en_US/fbevents.js";
export const META_PAGE_VIEW = "PageView";
export const META_LEAD = "Lead";
/** Official Handoff Location is an application, not a completed account signup. */
export const META_HANDOFF_APPLY = "HandoffApply";

export function metaPixelId(raw: string | undefined): string | null {
  const value = raw?.trim();
  return value && META_PIXEL_ID.test(value) ? value : null;
}

/** Script URL only after measurement consent and a usable id. Never the noscript beacon. */
export function planMetaLoad(
  consent: ConsentChoice | null,
  rawId: string | undefined,
): { id: string; src: string } | null {
  if (consent !== "all") return null;
  const id = metaPixelId(rawId);
  if (!id) return null;
  return { id, src: META_PIXEL_SRC };
}

export type MetaCall = { method: "track"; name: typeof META_LEAD } | { method: "trackCustom"; name: typeof META_HANDOFF_APPLY };

/** PageView is sent once when the pixel loads. Other events stay on our own counter. */
export function metaEventFor(event: MeasureEvent): MetaCall | null {
  if (event === "launch_signup") return { method: "track", name: META_LEAD };
  if (event === "handoff_apply") return { method: "trackCustom", name: META_HANDOFF_APPLY };
  return null;
}

export function consentSetCookie(choice: ConsentChoice, secure: boolean): string {
  return `${CONSENT_COOKIE}=${choice}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function readConsent(header: string): ConsentChoice | null {
  const match = header.match(/(?:^|;\s*)rummlee_consent=(essential|all)(?:\s*;|$)/);
  return match ? (match[1] as ConsentChoice) : null;
}

function clip(value: string | null, max: number): string | null {
  if (!value) return null;
  const clean = value.trim().slice(0, max);
  return /^[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=% -]+$/.test(clean) ? clean : null;
}

export function buildMeasureRow(event: string, path: string, search: string) {
  if (!MEASURE_EVENTS.includes(event as MeasureEvent)) return null;
  const pathname = path.startsWith("/") ? path.slice(0, 80) : null;
  if (!pathname || pathname.includes("?") || pathname.includes(" ")) return null;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const utm: Record<(typeof UTM_KEY)[number], string | null> = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
  };
  for (const key of UTM_KEY) utm[key] = clip(params.get(key), 40);
  return { event: event as MeasureEvent, path: pathname, ...utm };
}

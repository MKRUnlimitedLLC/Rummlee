export type UtmFields = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
};

export const EMPTY_UTM: UtmFields = {
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
};

const LIMITS = {
  utmSource: 80,
  utmMedium: 80,
  utmCampaign: 120,
  utmContent: 120,
  utmTerm: 120,
} as const;

function clip(raw: unknown, max: number) {
  if (typeof raw !== "string") return null;
  let text = "";
  for (const char of raw) {
    const code = char.charCodeAt(0);
    text += code < 32 || code === 127 ? " " : char;
  }
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, max);
}

/** Keep only the five campaign params. Missing or blank values stay null. */
export function readUtm(
  input: Partial<UtmFields> | null | undefined,
): UtmFields {
  return {
    utmSource: clip(input?.utmSource, LIMITS.utmSource),
    utmMedium: clip(input?.utmMedium, LIMITS.utmMedium),
    utmCampaign: clip(input?.utmCampaign, LIMITS.utmCampaign),
    utmContent: clip(input?.utmContent, LIMITS.utmContent),
    utmTerm: clip(input?.utmTerm, LIMITS.utmTerm),
  };
}

export function parseUtmSearch(search: string): UtmFields {
  const params = new URLSearchParams(search);
  return readUtm({
    utmSource: params.get("utm_source"),
    utmMedium: params.get("utm_medium"),
    utmCampaign: params.get("utm_campaign"),
    utmContent: params.get("utm_content"),
    utmTerm: params.get("utm_term"),
  });
}

/** URL values win per key. A later page without params keeps what was already stored. */
export function mergeUtm(stored: UtmFields, fromUrl: UtmFields): UtmFields {
  return {
    utmSource: fromUrl.utmSource ?? stored.utmSource,
    utmMedium: fromUrl.utmMedium ?? stored.utmMedium,
    utmCampaign: fromUrl.utmCampaign ?? stored.utmCampaign,
    utmContent: fromUrl.utmContent ?? stored.utmContent,
    utmTerm: fromUrl.utmTerm ?? stored.utmTerm,
  };
}

export function utmHasAny(fields: UtmFields) {
  return Object.values(fields).some((value) => Boolean(value));
}

/** source stays site unless the visit’s utm_source is exactly meta. */
export function sourceForUtm(utm: UtmFields): "site" | "meta" {
  if (utm.utmSource?.toLowerCase() === "meta") return "meta";
  return "site";
}

import {
  EMPTY_UTM,
  mergeUtm,
  parseUtmSearch,
  readUtm,
  utmHasAny,
  type UtmFields,
} from "./utm";

const KEY = "rummlee.utm.v1";

/** Remember campaign params for this tab so a later form still has them. */
export function capturePageUtm(): UtmFields {
  if (typeof window === "undefined") return EMPTY_UTM;
  let stored = EMPTY_UTM;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) stored = readUtm(JSON.parse(raw) as Partial<UtmFields>);
  } catch {
    stored = EMPTY_UTM;
  }
  const fields = mergeUtm(stored, parseUtmSearch(window.location.search));
  if (utmHasAny(fields)) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(fields));
    } catch {
      /* private mode */
    }
  }
  return fields;
}

export function utmPayload(fields: UtmFields) {
  return {
    utmSource: fields.utmSource ?? undefined,
    utmMedium: fields.utmMedium ?? undefined,
    utmCampaign: fields.utmCampaign ?? undefined,
    utmContent: fields.utmContent ?? undefined,
    utmTerm: fields.utmTerm ?? undefined,
  };
}

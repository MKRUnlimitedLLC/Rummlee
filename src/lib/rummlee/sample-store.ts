/**
 * Seeded demo counters. An admitted store is `partner-` plus 8 hex characters
 * from the application id, and is not in this set. Do not treat that id as a sample.
 */
export const SAMPLE_PARTNER_SPOT_IDS = [
  "partner-slope",
  "partner-silverlake",
  "partner-austin",
  "partner-lincoln",
  "partner-seattle",
  "partner-decatur",
  "partner-denver",
  "partner-bethesda",
  "partner-plano",
  "partner-cambridge",
  "partner-scottsdale",
  "partner-naperville",
  "partner-westfargo",
  "partner-uptown",
] as const;

const SAMPLE_PARTNER_SPOTS = new Set<string>(SAMPLE_PARTNER_SPOT_IDS);

const OFFICIAL_LEAD = /^(?:Official store|Official Rummlee partner)\.\s*/i;
const SAMPLE_LEAD = /^Sample only\. No store has signed\.\s*/i;

export function isSamplePartnerSpot(id: string | null | undefined) {
  return Boolean(id && SAMPLE_PARTNER_SPOTS.has(id));
}

/** Homepage and sale cards. A seeded seller at a partner counter is still a sample. */
export function isSampleStoreCard(input: {
  handoffSpotId?: string | null;
  sellerId?: string | null;
  partner: boolean;
}) {
  if (isSamplePartnerSpot(input.handoffSpotId)) return true;
  return Boolean(input.partner && input.sellerId?.startsWith("seed-"));
}

export function sampleStoreEyebrow(spotId: string | null | undefined) {
  return isSamplePartnerSpot(spotId) ? "Sample · not signed" : "Official store handoff";
}

/** Keeps the practical note (lot, hours) and removes the claim that a shop signed. */
export function publicSpotHint(spotId: string | null | undefined, hint: string) {
  if (!isSamplePartnerSpot(spotId)) return hint;
  const rest = hint.replace(OFFICIAL_LEAD, "").replace(SAMPLE_LEAD, "").trim();
  const lead = "Sample only. No store has signed.";
  return rest ? `${lead} ${rest}` : lead;
}

export const FEE_RATE = 0.05;
export const PREMIUM_FEE_RATE = 0;
export const MIN_PRICE_CENTS = 500;
export const PASTE_CAP = 40;
export const HOLD_LINE = "Money held until both confirm pickup.";

/** Stripe Identity is wired and capped. Off for the beta. Do not flip this without an explicit go-ahead. */
export const IDENTITY_ENABLED = false;
/** Successful Stripe ID matches allowed while the cap is on. */
export const IDENTITY_CAP = 50;

/** Photo fill suggests a title and category from the picture. Off for the beta. Plus includes it. */
export const PHOTO_FILL_ENABLED = false;

/** Fargo first. That market can store a package the seller leaves. */
export const HOUSE_FARGO = {
  profileId: "house-fargo",
  handle: "rummlee",
  saleId: "sale-house-fargo",
  neighborhood: "West Fargo, Fargo–Moorhead",
  market: "Fargo–Moorhead",
  spotId: "partner-westfargo",
} as const;

/** Half of what Rummlee receives as seller on a left-item resale. Not a buyer fee. */
export const CHARITY_SHARE_BPS = 5000;

/** Beta: full product until pay. Pay is simulated test credits — never a card or bank. Flip off only when real billing is live. */
export const TEST_MODE = true;
export const TEST_STARTER_CENTS = 20000;
export const TEST_PAY_NOTE = "Beta — test credits. Not real money. No card is charged. Rummlee never ships.";
export const PLUS_SALE_DAYS_PER_MONTH = 5;
/** +++ has no monthly cap. A single sale is still limited by MAX_SALE_DAYS. */
export const TRIO_SALE_DAYS_PER_MONTH = null;
export const TRIO_RESEARCHES_PER_MONTH = 5;
/** +++ can see a seller’s hidden low this many times each calendar month. */
export const REVEALS_PER_MONTH = 5;
/** Items on one sale for everyone except Rummlee +++. */
export const SALE_ITEM_CAP = 40;
export const MAX_SALE_DAYS = 14;

/** Plus is a monthly cap. +++ is null — unlimited free sale days. */
export function saleDayAllowance(tier: "plus" | "trio" | null | undefined): number | null {
  if (tier === "trio") return null;
  if (tier === "plus") return PLUS_SALE_DAYS_PER_MONTH;
  return 0;
}

export const NEIGHBORHOODS = [
  "Park Slope, Brooklyn",
  "Silver Lake, Los Angeles",
  "Pasadena, Los Angeles",
  "East Austin, Austin",
  "Lincoln Park, Chicago",
  "Naperville, Chicago",
  "Capitol Hill, Seattle",
  "Decatur, Atlanta",
  "LoHi, Denver",
  "Bethesda, DC",
  "Arlington, DC",
  "Plano, Dallas",
  "Cambridge, Boston",
  "Brookline, Boston",
  "Scottsdale, Phoenix",
  "West Fargo, Fargo–Moorhead",
  "Uptown, Minneapolis",
] as const;

export const CITIES = [
  "Brooklyn",
  "Los Angeles",
  "Austin",
  "Chicago",
  "Seattle",
  "Atlanta",
  "Denver",
  "DC",
  "Dallas",
  "Boston",
  "Phoenix",
  "Fargo–Moorhead",
  "Minneapolis",
] as const;

export const CATEGORIES = [
  { id: "furniture", label: "Furniture" },
  { id: "home", label: "Home" },
  { id: "kitchen", label: "Kitchen" },
  { id: "kids", label: "Kids" },
  { id: "clothing", label: "Clothing" },
  { id: "beauty", label: "Beauty" },
  { id: "plants", label: "Plants" },
  { id: "outdoor", label: "Outdoor" },
  { id: "other", label: "Other" },
] as const;

export const CONDITIONS = ["Like new", "Good", "Loved"] as const;

export const HAULS = [
  { id: "bag", label: "Fits in a bag" },
  { id: "one", label: "One-person carry" },
  { id: "two", label: "Two-person job — stairs or elevator" },
  { id: "truck", label: "Needs a truck" },
] as const;

export const SALE_KINDS = [
  { id: "garage", label: "Neighborhood sale", blurb: "List this week. Neighbors offer before Saturday." },
  { id: "moving", label: "Moving sale", blurb: "Clear the house before the truck." },
  { id: "clearout", label: "Home clearout", blurb: "Closet, spare room, and the extra dresser." },
] as const;

export const HANDOFF_MODES = [
  {
    id: "official",
    label: "Official partner store",
    hint: "A Rummlee partner store. The street shows after someone pays. Before that, a rough distance.",
  },
  {
    id: "public",
    label: "Public handoff location",
    hint: "Park, library, or civic lot. The street shows after someone pays. Before that, a rough distance.",
  },
  {
    id: "person",
    label: "Private handoff",
    hint: "You meet as handles. The address shows after someone pays. Before that, a rough distance. Rummlee never ships.",
  },
] as const;

export const HANDLE_ADJ = [
  "linen",
  "olive",
  "cedar",
  "dune",
  "harbor",
  "maple",
  "quiet",
  "sunny",
  "sage",
  "loft",
] as const;

export const HANDLE_NOUN = [
  "lark",
  "wren",
  "loft",
  "crate",
  "willow",
  "grove",
  "haven",
  "studio",
  "nook",
  "row",
] as const;

/** Short / legacy listing URLs → live seed ids. */
export const LISTING_ALIASES: Record<string, string> = {
  "cream-mixer": "mixer",
  "cream-sofa": "fm-couch",
  "cream-couch": "fm-couch",
  sofa: "fm-couch",
  couch: "fm-couch",
  desk: "fm-desk",
  ladder: "fm-ladder",
  tools: "fm-tools",
  garden: "fm-garden",
  "tool-chest": "fm-tools",
  "coffee-maker": "coffee-maker",
  "air-fryer": "air-fryer",
  microwave: "fm-microwave",
  trailer: "fm-trailer",
};

export function resolveListingId(raw: string) {
  const id = raw.replace(/\.svg$/i, "").trim();
  return LISTING_ALIASES[id] ?? id;
}

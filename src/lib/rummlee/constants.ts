export const FEE_RATE = 0.05;
export const PREMIUM_FEE_RATE = 0;
export const MIN_PRICE_CENTS = 500;
export const PASTE_CAP = 40;
export const HOLD_LINE = "Your money stays held until pickup.";

/** Beta: full product until pay. Pay is simulated test credits — never a card or bank. Flip off only when real billing is live. */
export const TEST_MODE = true;
export const TEST_STARTER_CENTS = 20000;
export const TEST_PAY_NOTE = "Beta — test credits. Not real money. No card is charged. Nothing ships.";

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
    label: "Official store handoff",
    hint: "A Rummlee official store. Locker or pickup desk, store hours. Default for most listings.",
  },
  {
    id: "public",
    label: "Public place handoff",
    hint: "Park, library, or civic lot. Still no home address. You choose whether to offer it.",
  },
  {
    id: "person",
    label: "In person handoff",
    hint: "Meet in person as handles. Still no home address on the listing. You choose whether to offer it.",
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

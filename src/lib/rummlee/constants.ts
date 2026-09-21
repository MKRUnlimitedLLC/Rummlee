export const FEE_RATE = 0.1;
export const PREMIUM_FEE_RATE = 0.05;
export const MIN_PRICE_CENTS = 500;

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
  { id: "two", label: "Two-person job" },
  { id: "truck", label: "Needs a truck" },
] as const;

export const SALE_KINDS = [
  { id: "garage", label: "Neighborhood sale", blurb: "List this week. Neighbors offer before Saturday." },
  { id: "moving", label: "Moving sale", blurb: "Clear the house before the truck." },
  { id: "clearout", label: "Home clearout", blurb: "Closet, garage, and the extra dresser." },
] as const;

export const HANDOFF_MODES = [
  { id: "official", label: "Partner store", hint: "Official Rummlee partner. Locker or pickup desk, store hours." },
  { id: "porch", label: "Person to person", hint: "Optional. Still a handle — still no home address posted." },
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
  "stoop",
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

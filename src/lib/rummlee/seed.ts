import type { Sql } from "@/lib/db";
import { addDaysIso, nextSaturdayIso } from "./format";
import { DEFAULT_FEES } from "./fees";

const SEED_VERSION = "v10-love";

type SeedListing = {
  id: string;
  saleId: string;
  sellerId: string;
  title: string;
  description: string;
  priceCents: number;
  buyNowCents: number | null;
  originalCents: number | null;
  floorCents?: number;
  category: string;
  condition: string;
  haul: string;
  sizeLabel?: string;
  neighborhood: string;
  photo: string;
  modes: string;
};

export async function ensureFees(sql: Sql) {
  for (const fee of DEFAULT_FEES) {
    await sql`
      insert into rummlee_fees (
        id, label, description, unit, percent_bps, amount_cents, charged_to, charged_when, sort, enabled
      ) values (
        ${fee.id}, ${fee.label}, ${fee.description}, ${fee.unit}, ${fee.percentBps}, ${fee.amountCents},
        ${fee.chargedTo}, ${fee.chargedWhen}, ${fee.sort}, ${fee.enabled}
      )
      on conflict (id) do nothing
    `;
  }
  const pack = "plus-v4";
  const marked = await sql<{ value: string }>`select value from app_meta where key = ${"fees_pack"}`;
  if (marked[0]?.value === pack) return;
  for (const fee of DEFAULT_FEES) {
    await sql`
      update rummlee_fees set
        label = ${fee.label},
        description = ${fee.description},
        unit = ${fee.unit},
        percent_bps = ${fee.percentBps},
        amount_cents = ${fee.amountCents},
        charged_to = ${fee.chargedTo},
        charged_when = ${fee.chargedWhen},
        sort = ${fee.sort},
        enabled = ${fee.enabled}
      where id = ${fee.id}
    `;
  }
  await sql`
    insert into app_meta (key, value) values (${"fees_pack"}, ${pack})
    on conflict (key) do update set value = ${pack}
  `;
}

export async function ensureSeed(sql: Sql) {
  await ensureFees(sql);
  const existing = await sql<{ value: string }>`select value from app_meta where key = ${"seeded"}`;
  if (existing[0]?.value === SEED_VERSION) return;

  await wipeSeed(sql);

  const sat = nextSaturdayIso();
  const sun = addDaysIso(sat, 1);
  const fri = addDaysIso(sat, -1);

  const sellers = [
    { id: "seed-linen-lark", handle: "linen_lark", neighborhood: "Park Slope, Brooklyn" },
    { id: "seed-olive-loft", handle: "olive_loft", neighborhood: "Silver Lake, Los Angeles" },
    { id: "seed-cedar-nook", handle: "cedar_nook", neighborhood: "East Austin, Austin" },
    { id: "seed-harbor-row", handle: "harbor_row", neighborhood: "Lincoln Park, Chicago" },
    { id: "seed-maple-haven", handle: "maple_haven", neighborhood: "Capitol Hill, Seattle" },
    { id: "seed-dune-studio", handle: "dune_studio", neighborhood: "Scottsdale, Phoenix" },
    { id: "seed-quiet-willow", handle: "quiet_willow", neighborhood: "Bethesda, DC" },
    { id: "seed-prairie-row", handle: "prairie_row", neighborhood: "West Fargo, Fargo–Moorhead" },
    { id: "seed-north-loft", handle: "north_loft", neighborhood: "Uptown, Minneapolis" },
  ];

  for (const s of sellers) {
    await sql`
      insert into profiles (id, handle, neighborhood, zip, is_premium, wallet_cents)
      values (${s.id}, ${s.handle}, ${s.neighborhood}, ${null}, ${false}, ${0})
      on conflict (id) do nothing
    `;
  }

  await sql`alter table handoff_spots add column if not exists kind text not null default 'public'`;

  const spots = [
    { id: "partner-slope", name: "9th Street Market", area: "Park Slope, Brooklyn", hint: "Official Rummlee partner. Customer lot, locker by the florist. Store hours.", kind: "partner" },
    { id: "partner-silverlake", name: "Sunset Home", area: "Silver Lake, Los Angeles", hint: "Official Rummlee partner. Side lot, pickup desk inside. Store hours.", kind: "partner" },
    { id: "partner-austin", name: "Mueller Market", area: "East Austin, Austin", hint: "Official Rummlee partner. East lot, locker by customer service.", kind: "partner" },
    { id: "partner-lincoln", name: "Clark Street Market", area: "Lincoln Park, Chicago", hint: "Official Rummlee partner. Rear lot, store hours only.", kind: "partner" },
    { id: "partner-seattle", name: "Pike Home", area: "Capitol Hill, Seattle", hint: "Official Rummlee partner. Alley lot, locker by the garden center.", kind: "partner" },
    { id: "partner-decatur", name: "Ponce Market", area: "Decatur, Atlanta", hint: "Official Rummlee partner. North lot, grocery hours.", kind: "partner" },
    { id: "partner-denver", name: "Platte Market", area: "LoHi, Denver", hint: "Official Rummlee partner. Front lot, locker near the florist.", kind: "partner" },
    { id: "partner-bethesda", name: "Wisconsin Market", area: "Bethesda, DC", hint: "Official Rummlee partner. Garage level P1, pickup desk.", kind: "partner" },
    { id: "partner-plano", name: "Preston Home", area: "Plano, Dallas", hint: "Official Rummlee partner. Garden-center lot, store hours.", kind: "partner" },
    { id: "partner-cambridge", name: "Harvard Square Market", area: "Cambridge, Boston", hint: "Official Rummlee partner. Rear lot, locker by the cafe.", kind: "partner" },
    { id: "partner-scottsdale", name: "Scottsdale Home", area: "Scottsdale, Phoenix", hint: "Official Rummlee partner. Covered lot, pickup desk inside.", kind: "partner" },
    { id: "partner-naperville", name: "Ogden Market", area: "Naperville, Chicago", hint: "Official Rummlee partner. Side lot, store hours.", kind: "partner" },
    { id: "public-prospect", name: "Prospect Park — 9th St", area: "Park Slope, Brooklyn", hint: "Circle lot by the 9th Street entrance, daylight.", kind: "public" },
    { id: "public-meadows", name: "Silver Lake Meadows", area: "Silver Lake, Los Angeles", hint: "West lot off Silver Lake Blvd.", kind: "public" },
    { id: "public-austin", name: "Mueller Lake Park", area: "East Austin, Austin", hint: "North lot, daylight hours.", kind: "public" },
    { id: "public-lincoln", name: "Lincoln Park Conservatory", area: "Lincoln Park, Chicago", hint: "South lot, stay near the greenhouse doors.", kind: "public" },
    { id: "public-calanderson", name: "Cal Anderson Park", area: "Capitol Hill, Seattle", hint: "North lawn, by the shelterhouse.", kind: "public" },
    { id: "public-citypark", name: "City Park — Ferril Lake", area: "LoHi, Denver", hint: "East lot, stay near the pavilion.", kind: "public" },
    { id: "public-bethesda", name: "Bethesda Library", area: "Bethesda, DC", hint: "Front lot, library hours.", kind: "public" },
    { id: "public-plano", name: "Arbor Hills Nature Preserve", area: "Plano, Dallas", hint: "Main lot, by the trailhead kiosk.", kind: "public" },
    { id: "public-harvard", name: "Cambridge Public Library", area: "Cambridge, Boston", hint: "Broadway lot, near the main doors.", kind: "public" },
    { id: "public-scottsdale", name: "Scottsdale Civic Center", area: "Scottsdale, Phoenix", hint: "West plaza, daylight hours.", kind: "public" },
    { id: "public-naperville", name: "Naper Settlement lot", area: "Naperville, Chicago", hint: "Visitor lot off Aurora Ave.", kind: "public" },
    { id: "partner-westfargo", name: "13th Avenue Market", area: "West Fargo, Fargo–Moorhead", hint: "Official Rummlee partner. Front lot, locker by customer service. Store hours.", kind: "partner" },
    { id: "public-westfargo", name: "West Fargo Library", area: "West Fargo, Fargo–Moorhead", hint: "Front lot, library hours. Daylight handoff.", kind: "public" },
    { id: "partner-uptown", name: "Hennepin Home", area: "Uptown, Minneapolis", hint: "Official Rummlee partner. Side lot, pickup desk inside. Store hours.", kind: "partner" },
    { id: "public-uptown", name: "Lake of the Isles — 28th St", area: "Uptown, Minneapolis", hint: "East lot, daylight hours.", kind: "public" },
  ];
  for (const s of spots) {
    await sql`
      insert into handoff_spots (id, name, area, hint, kind)
      values (${s.id}, ${s.name}, ${s.area}, ${s.hint}, ${s.kind})
      on conflict (id) do nothing
    `;
  }

  const sales = [
    {
      id: "sale-slope",
      sellerId: "seed-linen-lark",
      name: "Park Slope Saturday",
      kind: "garage",
      neighborhood: "Park Slope, Brooklyn",
      starts: sat,
      ends: sat,
      spot: "partner-slope",
    },
    {
      id: "sale-silverlake",
      sellerId: "seed-olive-loft",
      name: "Silver Lake moving sale",
      kind: "moving",
      neighborhood: "Silver Lake, Los Angeles",
      starts: fri,
      ends: sun,
      spot: "partner-silverlake",
    },
    {
      id: "sale-austin",
      sellerId: "seed-cedar-nook",
      name: "East Austin clearout",
      kind: "clearout",
      neighborhood: "East Austin, Austin",
      starts: sat,
      ends: sun,
      spot: "partner-austin",
    },
    {
      id: "sale-lincoln",
      sellerId: "seed-harbor-row",
      name: "Lincoln Park home sale",
      kind: "garage",
      neighborhood: "Lincoln Park, Chicago",
      starts: sat,
      ends: sat,
      spot: "partner-lincoln",
    },
    {
      id: "sale-seattle",
      sellerId: "seed-maple-haven",
      name: "Capitol Hill weekend",
      kind: "garage",
      neighborhood: "Capitol Hill, Seattle",
      starts: sat,
      ends: sun,
      spot: "partner-seattle",
    },
    {
      id: "sale-scottsdale",
      sellerId: "seed-dune-studio",
      name: "Scottsdale patio sale",
      kind: "moving",
      neighborhood: "Scottsdale, Phoenix",
      starts: sat,
      ends: sat,
      spot: "partner-scottsdale",
    },
    {
      id: "sale-bethesda",
      sellerId: "seed-quiet-willow",
      name: "Bethesda closet edit",
      kind: "clearout",
      neighborhood: "Bethesda, DC",
      starts: fri,
      ends: sat,
      spot: "partner-bethesda",
    },
    {
      id: "sale-westfargo",
      sellerId: "seed-prairie-row",
      name: "West Fargo moving sale",
      kind: "moving",
      neighborhood: "West Fargo, Fargo–Moorhead",
      starts: fri,
      ends: sun,
      spot: "partner-westfargo",
      modes: "official,public",
    },
    {
      id: "sale-uptown",
      sellerId: "seed-north-loft",
      name: "Uptown moving sale",
      kind: "moving",
      neighborhood: "Uptown, Minneapolis",
      starts: fri,
      ends: sun,
      spot: "partner-uptown",
      modes: "official,public",
    },
  ];

  for (const s of sales) {
    await sql`
      insert into sales (id, seller_id, name, kind, neighborhood, starts_on, ends_on, handoff_modes, handoff_spot_id, status)
      values (${s.id}, ${s.sellerId}, ${s.name}, ${s.kind}, ${s.neighborhood}, ${s.starts}::date, ${s.ends}::date, ${"modes" in s ? s.modes : "official"}, ${s.spot}, ${"live"})
      on conflict (id) do nothing
    `;
  }

  const listings: SeedListing[] = [
    {
      id: "armchair",
      saleId: "sale-silverlake",
      sellerId: "seed-olive-loft",
      title: "Bouclé lounge chair",
      description: "Cream bouclé, tapered walnut legs. One faint mark on the left arm. Two-person carry.",
      priceCents: 18500,
      buyNowCents: 18500,
      originalCents: 89000,
      category: "furniture",
      condition: "Good",
      haul: "two",
      neighborhood: "Silver Lake, Los Angeles",
      photo: "/listings/armchair.jpg",
      modes: "official",
    },
    {
      id: "oak-table",
      saleId: "sale-lincoln",
      sellerId: "seed-harbor-row",
      title: "White oak coffee table",
      description: "Low, tapered legs, no wobble. Fits a small living room. Meet at Clark Street Market — official partner, store hours.",
      priceCents: 12000,
      buyNowCents: 12000,
      originalCents: 42000,
      category: "furniture",
      condition: "Like new",
      haul: "two",
      neighborhood: "Lincoln Park, Chicago",
      photo: "/listings/oak-table.jpg",
      modes: "official",
    },
    {
      id: "olive-tree",
      saleId: "sale-austin",
      sellerId: "seed-cedar-nook",
      title: "Olive tree in terracotta",
      description: "About four feet, healthy, been in a bright window. Pot is heavy — bring a friend or a wagon.",
      priceCents: 6500,
      buyNowCents: 6500,
      originalCents: 18000,
      category: "plants",
      condition: "Good",
      haul: "two",
      neighborhood: "East Austin, Austin",
      photo: "/listings/olive-tree.jpg",
      modes: "official,public",
    },
    {
      id: "mixer",
      saleId: "sale-slope",
      sellerId: "seed-linen-lark",
      title: "Cream stand mixer",
      description: "KitchenAid-style mixer from a kitchen we’re leaving. Bowl, whisk, and dough hook included.",
      priceCents: 9500,
      buyNowCents: 9500,
      originalCents: 38000,
      category: "kitchen",
      condition: "Like new",
      haul: "one",
      neighborhood: "Park Slope, Brooklyn",
      photo: "/listings/mixer.jpg",
      modes: "official,public,person",
    },
    {
      id: "linen-duvet",
      saleId: "sale-seattle",
      sellerId: "seed-maple-haven",
      title: "Oatmeal linen duvet",
      description: "Queen set, washed once. Pillowcases included. Soft, a little rumpled on purpose.",
      priceCents: 4200,
      buyNowCents: 4200,
      originalCents: 16000,
      category: "home",
      condition: "Like new",
      haul: "bag",
      neighborhood: "Capitol Hill, Seattle",
      photo: "/listings/linen-duvet.jpg",
      modes: "official,public",
    },
    {
      id: "stoneware",
      saleId: "sale-slope",
      sellerId: "seed-linen-lark",
      title: "Cream ceramic dinner set",
      description: "Six plates and bowls, soft cream glaze. One tiny chip on a bowl rim. Stacks cleanly.",
      priceCents: 3800,
      buyNowCents: 3800,
      originalCents: 12000,
      category: "kitchen",
      condition: "Good",
      haul: "one",
      neighborhood: "Park Slope, Brooklyn",
      photo: "/listings/stoneware.jpg",
      modes: "official",
    },
    {
      id: "merino",
      saleId: "sale-seattle",
      sellerId: "seed-maple-haven",
      title: "Camel merino crewneck",
      description: "Women’s M. No pills. From a closet edit — worn a handful of times.",
      priceCents: 2800,
      buyNowCents: 2800,
      originalCents: 14800,
      category: "clothing",
      condition: "Like new",
      haul: "bag",
      sizeLabel: "Women’s M",
      neighborhood: "Capitol Hill, Seattle",
      photo: "/listings/merino.jpg",
      modes: "official,public",
    },
    {
      id: "lounge-chair",
      saleId: "sale-scottsdale",
      sellerId: "seed-dune-studio",
      title: "Teak lounge chair",
      description: "Outdoor teak with a cream cushion. Lived on a covered patio. Cushion has light sun fade.",
      priceCents: 14000,
      buyNowCents: 14000,
      originalCents: 48000,
      category: "outdoor",
      condition: "Good",
      haul: "two",
      neighborhood: "Scottsdale, Phoenix",
      photo: "/listings/lounge-chair.jpg",
      modes: "official",
    },
    {
      id: "play-kitchen",
      saleId: "sale-lincoln",
      sellerId: "seed-harbor-row",
      title: "Kids play kitchen",
      description: "White oak play kitchen. Kids aged out. A few marker dots inside a cabinet — wipes off.",
      priceCents: 4500,
      buyNowCents: 4500,
      originalCents: 18000,
      category: "kids",
      condition: "Good",
      haul: "two",
      sizeLabel: "Ages 3–7",
      neighborhood: "Lincoln Park, Chicago",
      photo: "/listings/play-kitchen.jpg",
      modes: "official,public",
    },
    {
      id: "beauty-tray",
      saleId: "sale-austin",
      sellerId: "seed-cedar-nook",
      title: "Bathroom tray + bottles",
      description: "Marble tray, ceramic dish, and unopened extras from a cabinet cleanout. No half-used mystery pots.",
      priceCents: 1800,
      buyNowCents: 1800,
      originalCents: 6400,
      category: "beauty",
      condition: "Like new",
      haul: "bag",
      neighborhood: "East Austin, Austin",
      photo: "/listings/beauty-tray.jpg",
      modes: "official",
    },
    {
      id: "dresser",
      saleId: "sale-silverlake",
      sellerId: "seed-olive-loft",
      title: "Six-drawer dresser",
      description: "White oak, brass knobs, no warp. You’ll want a truck or two strong friends.",
      priceCents: 22000,
      buyNowCents: 22000,
      originalCents: 79000,
      category: "furniture",
      condition: "Good",
      haul: "truck",
      neighborhood: "Silver Lake, Los Angeles",
      photo: "/listings/dresser.jpg",
      modes: "official",
    },
    {
      id: "kids-bike",
      saleId: "sale-lincoln",
      sellerId: "seed-harbor-row",
      title: "Kids bike, 16\"",
      description: "Training wheels off, tires pumped. Helmet not included. Ready this weekend. Ages 4–6.",
      priceCents: 3500,
      buyNowCents: 3500,
      originalCents: 12000,
      category: "kids",
      condition: "Good",
      haul: "one",
      sizeLabel: "16\" / ages 4–6",
      neighborhood: "Lincoln Park, Chicago",
      photo: "/listings/kids-bike.jpg",
      modes: "official,public",
    },
    {
      id: "cashmere",
      saleId: "sale-bethesda",
      sellerId: "seed-quiet-willow",
      title: "Camel cashmere crewneck",
      description: "Women’s M. Soft, no pills. From a closet edit — worn a handful of times.",
      priceCents: 4800,
      buyNowCents: 4800,
      originalCents: 19800,
      category: "clothing",
      condition: "Like new",
      haul: "bag",
      sizeLabel: "Women’s M",
      neighborhood: "Bethesda, DC",
      photo: "/listings/cashmere.jpg",
      modes: "official,public",
    },
    {
      id: "fm-couch",
      saleId: "sale-westfargo",
      sellerId: "seed-prairie-row",
      title: "Cream two-seat sofa",
      description: "Soft cream sofa from a West Fargo move. One cushion is a little sat. Two-person carry. Official store on 13th.",
      priceCents: 9000,
      buyNowCents: 9000,
      originalCents: 64000,
      category: "furniture",
      condition: "Good",
      haul: "two",
      neighborhood: "West Fargo, Fargo–Moorhead",
      photo: "/listings/couch.svg",
      modes: "official,public,person",
    },
    {
      id: "fm-desk",
      saleId: "sale-westfargo",
      sellerId: "seed-prairie-row",
      title: "White desk, 48 inch",
      description: "Simple white desk from a spare room. A scuff on one leg. Fits a laptop and a lamp. Two-person carry.",
      priceCents: 12000,
      buyNowCents: 12000,
      originalCents: 28000,
      category: "furniture",
      condition: "Good",
      haul: "two",
      neighborhood: "West Fargo, Fargo–Moorhead",
      photo: "/listings/desk.svg",
      modes: "official,public",
    },
    {
      id: "fm-microwave",
      saleId: "sale-westfargo",
      sellerId: "seed-prairie-row",
      title: "Used counter microwave",
      description: "Works. Interior wiped clean. Turntable included. One-person carry from the partner store.",
      priceCents: 3500,
      buyNowCents: 3500,
      originalCents: 12000,
      category: "kitchen",
      condition: "Loved",
      haul: "one",
      neighborhood: "West Fargo, Fargo–Moorhead",
      photo: "/listings/microwave.svg",
      modes: "official",
    },
    {
      id: "fm-trailer",
      saleId: "sale-westfargo",
      sellerId: "seed-prairie-row",
      title: "Utility trailer, 5x8",
      description: "Open utility trailer. Lights work. You’ll need a hitch and a truck. Meet at the partner lot.",
      priceCents: 14000,
      buyNowCents: 14000,
      originalCents: 89000,
      category: "outdoor",
      condition: "Good",
      haul: "truck",
      neighborhood: "West Fargo, Fargo–Moorhead",
      photo: "/listings/trailer.svg",
      modes: "official,public",
    },
    {
      id: "fm-tools",
      saleId: "sale-westfargo",
      sellerId: "seed-prairie-row",
      title: "Rolling tool chest",
      description: "Metal chest with drawers. A few sockets missing. Heavy — bring a truck or a ramp.",
      priceCents: 8500,
      buyNowCents: 8500,
      originalCents: 32000,
      category: "outdoor",
      condition: "Good",
      haul: "truck",
      neighborhood: "West Fargo, Fargo–Moorhead",
      photo: "/listings/tool-chest.svg",
      modes: "official",
    },
    {
      id: "fm-garden",
      saleId: "sale-westfargo",
      sellerId: "seed-prairie-row",
      title: "Garden tools and wheelbarrow",
      description: "Spade, rake, and a wheelbarrow from a yard clearout. Dirt washed off. Needs a truck.",
      priceCents: 4500,
      buyNowCents: 4500,
      originalCents: 16000,
      category: "outdoor",
      condition: "Loved",
      haul: "truck",
      neighborhood: "West Fargo, Fargo–Moorhead",
      photo: "/listings/garden.svg",
      modes: "official,public",
    },
    {
      id: "fm-ladder",
      saleId: "sale-westfargo",
      sellerId: "seed-prairie-row",
      title: "Extension ladder, 24 ft",
      description: "Aluminum extension ladder. Locks hold. Long — it will not fit in a sedan.",
      priceCents: 5500,
      buyNowCents: 5500,
      originalCents: 22000,
      category: "outdoor",
      condition: "Good",
      haul: "truck",
      neighborhood: "West Fargo, Fargo–Moorhead",
      photo: "/listings/ladder.svg",
      modes: "official",
    },
    {
      id: "coffee-maker",
      saleId: "sale-slope",
      sellerId: "seed-linen-lark",
      title: "Drip coffee maker",
      description: "12-cup drip. Carafe is clean. Timer still works. One-person carry from the official store.",
      priceCents: 2200,
      buyNowCents: 2200,
      originalCents: 8000,
      category: "kitchen",
      condition: "Good",
      haul: "one",
      neighborhood: "Park Slope, Brooklyn",
      photo: "/listings/coffee-maker.svg",
      modes: "official,public",
    },
    {
      id: "toaster",
      saleId: "sale-slope",
      sellerId: "seed-linen-lark",
      title: "Two-slice toaster",
      description: "Works. A little crumb in the tray. Fits in a bag.",
      priceCents: 1200,
      buyNowCents: 1200,
      originalCents: 4000,
      category: "kitchen",
      condition: "Good",
      haul: "bag",
      neighborhood: "Park Slope, Brooklyn",
      photo: "/listings/toaster.svg",
      modes: "official",
    },
    {
      id: "blender",
      saleId: "sale-slope",
      sellerId: "seed-linen-lark",
      title: "Counter blender",
      description: "Pitcher, lid, and blade. Used for smoothies. One-person carry.",
      priceCents: 2800,
      buyNowCents: 2800,
      originalCents: 9000,
      category: "kitchen",
      condition: "Good",
      haul: "one",
      neighborhood: "Park Slope, Brooklyn",
      photo: "/listings/blender.svg",
      modes: "official,public",
    },
    {
      id: "air-fryer",
      saleId: "sale-slope",
      sellerId: "seed-linen-lark",
      title: "Compact air fryer",
      description: "Basket and crisper plate included. Used for fries and leftovers. Fits in a bag.",
      priceCents: 2500,
      buyNowCents: 2500,
      originalCents: 8000,
      category: "kitchen",
      condition: "Good",
      haul: "bag",
      neighborhood: "Park Slope, Brooklyn",
      photo: "/listings/air-fryer.svg",
      modes: "official,public",
    },
    {
      id: "msp-dresser",
      saleId: "sale-uptown",
      sellerId: "seed-north-loft",
      title: "Six-drawer dresser",
      description: "White oak dresser from an Uptown move. You’ll want a truck. Official store handoff on Hennepin.",
      priceCents: 18000,
      buyNowCents: 18000,
      originalCents: 72000,
      category: "furniture",
      condition: "Good",
      haul: "truck",
      neighborhood: "Uptown, Minneapolis",
      photo: "/listings/dresser.jpg",
      modes: "official,public",
    },
  ];

  for (const l of listings) {
    const floor = Math.min(l.priceCents, Math.max(500, Math.round((l.priceCents * 0.85) / 100) * 100));
    await sql`
      insert into listings (
        id, sale_id, seller_id, title, description, price_cents, buy_now_cents, original_cents, floor_cents,
        category, condition, haul, size_label, neighborhood, handoff_modes, photo_url, status
      ) values (
        ${l.id}, ${l.saleId}, ${l.sellerId}, ${l.title}, ${l.description}, ${l.priceCents},
        ${l.buyNowCents}, ${l.originalCents}, ${l.floorCents ?? floor}, ${l.category}, ${l.condition}, ${l.haul},
        ${l.sizeLabel ?? null}, ${l.neighborhood}, ${l.modes}, ${l.photo}, ${"live"}
      )
      on conflict (id) do nothing
    `;
  }

  await sql`insert into app_meta (key, value) values (${"seeded"}, ${SEED_VERSION}) on conflict (key) do update set value = ${SEED_VERSION}`;
}

async function wipeSeed(sql: Sql) {
  await sql`delete from saved_listings where listing_id in (select id from listings where seller_id like ${"seed-%"})`;
  await sql`delete from messages where listing_id in (select id from listings where seller_id like ${"seed-%"})`;
  await sql`delete from offers where seller_id like ${"seed-%"} or buyer_id like ${"seed-%"}`;
  await sql`delete from orders where seller_id like ${"seed-%"} or buyer_id like ${"seed-%"}`;
  await sql`delete from listings where seller_id like ${"seed-%"}`;
  await sql`delete from sales where seller_id like ${"seed-%"}`;
  await sql`delete from wallet_tx where user_id like ${"seed-%"}`;
  await sql`delete from profiles where id like ${"seed-%"}`;
  await sql`delete from handoff_spots`;
}

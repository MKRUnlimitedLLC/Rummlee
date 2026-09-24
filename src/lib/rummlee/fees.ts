export type FeeUnit = "percent" | "cents" | "none";
export type FeeChargedTo = "buyer" | "seller" | "none";
export type FeeWhen = "checkout" | "listing" | "upgrade" | "never";

export type FeeRow = {
  id: string;
  label: string;
  description: string;
  unit: FeeUnit;
  percentBps: number;
  amountCents: number;
  chargedTo: FeeChargedTo;
  chargedWhen: FeeWhen;
  sort: number;
  enabled: boolean;
};

/** Every Rummlee fee, each independently adjustable. Zero / none = free. */
export const DEFAULT_FEES: FeeRow[] = [
  {
    id: "browse",
    label: "Browse",
    description: "Looking at listings. Always free.",
    unit: "none",
    percentBps: 0,
    amountCents: 0,
    chargedTo: "none",
    chargedWhen: "never",
    sort: 10,
    enabled: true,
  },
  {
    id: "list",
    label: "List an item",
    description: "Charged to the seller when a listing goes live. $0 means free to list.",
    unit: "cents",
    percentBps: 0,
    amountCents: 0,
    chargedTo: "seller",
    chargedWhen: "listing",
    sort: 20,
    enabled: true,
  },
  {
    id: "min_asking",
    label: "Minimum asking",
    description: "Floor for an asking price. Not a fee — listings below this cannot publish.",
    unit: "cents",
    percentBps: 0,
    amountCents: 500,
    chargedTo: "none",
    chargedWhen: "listing",
    sort: 30,
    enabled: true,
  },
  {
    id: "buyer_standard",
    label: "Buyer fee",
    description: "Added on top of asking at checkout for everyone without Rummlee Plus. 5%.",
    unit: "percent",
    percentBps: 500,
    amountCents: 0,
    chargedTo: "buyer",
    chargedWhen: "checkout",
    sort: 40,
    enabled: true,
  },
  {
    id: "buyer_premium",
    label: "Buyer fee with Rummlee Plus",
    description: "Checkout buyer fee when the buyer has Rummlee Plus or Rummlee +++. 0%. The seller fee is not waived.",
    unit: "percent",
    percentBps: 0,
    amountCents: 0,
    chargedTo: "buyer",
    chargedWhen: "checkout",
    sort: 50,
    enabled: true,
  },
  {
    id: "premium_switch",
    label: "Rummlee Plus, monthly",
    description: "One month of Rummlee Plus. Buyer fee is $0. Seller still pays the Plus seller fee. Includes 5 sale days a month and ID Verified. Test credits during beta.",
    unit: "cents",
    percentBps: 0,
    amountCents: 999,
    chargedTo: "buyer",
    chargedWhen: "upgrade",
    sort: 60,
    enabled: true,
  },
  {
    id: "plus_year",
    label: "Rummlee Plus, yearly",
    description: "One year of Rummlee Plus. Same benefits as the monthly plan.",
    unit: "cents",
    percentBps: 0,
    amountCents: 9999,
    chargedTo: "buyer",
    chargedWhen: "upgrade",
    sort: 65,
    enabled: true,
  },
  {
    id: "trio_month",
    label: "Rummlee +++ , monthly",
    description: "Includes Plus, a lower seller fee, unlimited sale days, 5 researcher requests a month, Rummlee Reveal 5 times a month, and no item cap. Extra researches are the ask fee. Test credits during beta.",
    unit: "cents",
    percentBps: 0,
    amountCents: 3999,
    chargedTo: "buyer",
    chargedWhen: "upgrade",
    sort: 66,
    enabled: true,
  },
  {
    id: "trio_year",
    label: "Rummlee +++ , yearly",
    description: "A year of Rummlee +++. Same benefits as the monthly plan.",
    unit: "cents",
    percentBps: 0,
    amountCents: 39999,
    chargedTo: "buyer",
    chargedWhen: "upgrade",
    sort: 66,
    enabled: true,
  },
  {
    id: "id_verify",
    label: "ID Verified, one-time",
    description: "One-time fee for the ID Verified badge, charged only after Stripe Identity matches the legal name. Free with Rummlee Plus. Off during beta. Rummlee does not keep a photo of the ID.",
    unit: "cents",
    percentBps: 0,
    amountCents: 499,
    chargedTo: "buyer",
    chargedWhen: "upgrade",
    sort: 67,
    enabled: true,
  },
  {
    id: "sale_day",
    label: "Sale day, seller",
    description: "Charged to the seller for each date a sale runs. Plus includes 5 sale days each calendar month. +++ sale days are free. A single sale still cannot run longer than 14 days. Extra Plus days and every Standard day pay this.",
    unit: "cents",
    percentBps: 0,
    amountCents: 299,
    chargedTo: "seller",
    chargedWhen: "listing",
    sort: 68,
    enabled: true,
  },
  {
    id: "feature_item",
    label: "Feature an item",
    description: "Puts one listing ahead of others until that sale ends. Charged to the seller. Taken from test credits, then from the next payout.",
    unit: "cents",
    percentBps: 0,
    amountCents: 199,
    chargedTo: "seller",
    chargedWhen: "listing",
    sort: 681,
    enabled: true,
  },
  {
    id: "feature_sale",
    label: "Feature a sale",
    description: "Puts every item in the sale ahead of others until the sale ends. Charged to the seller. Taken from test credits, then from the next payout.",
    unit: "cents",
    percentBps: 0,
    amountCents: 499,
    chargedTo: "seller",
    chargedWhen: "listing",
    sort: 682,
    enabled: true,
  },
  {
    id: "photo_fill",
    label: "Photo fill, seller",
    description: "Suggests a title, category, condition, and haul from the listing photo. $0.99 on every tier. Does not set the asking price, the lowest price, or the weight. Off during beta, so this is not charged yet.",
    unit: "cents",
    percentBps: 0,
    amountCents: 99,
    chargedTo: "seller",
    chargedWhen: "listing",
    sort: 69,
    enabled: true,
  },
  {
    id: "research_ask",
    label: "Ask a researcher",
    description: "Seller pays this to send photos to a Rummlee researcher. They suggest what it is and a price range. The seller still sets the asking price and the lowest price. Covers the researcher payout. Test credits during beta.",
    unit: "cents",
    percentBps: 0,
    amountCents: 799,
    chargedTo: "seller",
    chargedWhen: "listing",
    sort: 70,
    enabled: true,
  },
  {
    id: "research_pay",
    label: "Researcher payout",
    description: "Paid to the researcher when the seller accepts their write-up. $4.60 is 15 minutes at $18.40 an hour, the highest 2026 minimum wage (Washington, D.C.). Never more than what that seller paid to ask. Not paid if the seller declines.",
    unit: "cents",
    percentBps: 0,
    amountCents: 460,
    chargedTo: "seller",
    chargedWhen: "listing",
    sort: 71,
    enabled: true,
  },
  {
    id: "research_range_bonus",
    label: "Researcher range bonus",
    description: "Extra pay when the item sells in the top half of the researcher’s recommended range, or above it. Paid when the seller’s payout releases, not when the write-up is accepted. Adjust this on its own.",
    unit: "cents",
    percentBps: 0,
    amountCents: 250,
    chargedTo: "seller",
    chargedWhen: "checkout",
    sort: 72,
    enabled: true,
  },
  {
    id: "research_asking_bonus",
    label: "Researcher asking bonus",
    description: "Extra pay when the item sells at the full asking price. Stacks with the range bonus. Paid when the seller’s payout releases.",
    unit: "cents",
    percentBps: 0,
    amountCents: 250,
    chargedTo: "seller",
    chargedWhen: "checkout",
    sort: 73,
    enabled: true,
  },
  {
    id: "seller_floor",
    label: "Seller fee floor",
    description: "The seller pays this or their tier percent, whichever is more. Same on official store, public place, and in person. Not waived by Plus or +++.",
    unit: "cents",
    percentBps: 0,
    amountCents: 299,
    chargedTo: "seller",
    chargedWhen: "checkout",
    sort: 74,
    enabled: true,
  },
  {
    id: "seller_payout",
    label: "Seller fee, Standard",
    description: "Standard seller percent. The seller pays this or the seller fee floor, whichever is more.",
    unit: "percent",
    percentBps: 1200,
    amountCents: 0,
    chargedTo: "seller",
    chargedWhen: "checkout",
    sort: 75,
    enabled: true,
  },
  {
    id: "seller_plus",
    label: "Seller fee, Plus",
    description: "Plus seller percent. The seller pays this or the seller fee floor, whichever is more. Plus does not waive it.",
    unit: "percent",
    percentBps: 850,
    amountCents: 0,
    chargedTo: "seller",
    chargedWhen: "checkout",
    sort: 76,
    enabled: true,
  },
  {
    id: "seller_trio",
    label: "Seller fee, +++",
    description: "+++ seller percent. The seller pays this or the seller fee floor, whichever is more. +++ does not waive it.",
    unit: "percent",
    percentBps: 600,
    amountCents: 0,
    chargedTo: "seller",
    chargedWhen: "checkout",
    sort: 77,
    enabled: true,
  },
  {
    id: "official_handoff",
    label: "Official store, buyer",
    description: "Not charged. Official store, public place, and in person use the same buyer fee. Left at $0 so it can be turned back on without a code change.",
    unit: "cents",
    percentBps: 0,
    amountCents: 0,
    chargedTo: "buyer",
    chargedWhen: "checkout",
    sort: 80,
    enabled: true,
  },
  {
    id: "official_handoff_seller",
    label: "Official store, seller",
    description: "Not charged. The seller fee does not change with the handoff location. Left at $0 so it can be turned back on without a code change.",
    unit: "cents",
    percentBps: 0,
    amountCents: 0,
    chargedTo: "seller",
    chargedWhen: "checkout",
    sort: 85,
    enabled: true,
  },
  {
    id: "public_handoff",
    label: "Public place handoff",
    description: "Added at checkout when the buyer picks a public place handoff location.",
    unit: "cents",
    percentBps: 0,
    amountCents: 0,
    chargedTo: "buyer",
    chargedWhen: "checkout",
    sort: 90,
    enabled: true,
  },
  {
    id: "person_handoff",
    label: "In person handoff",
    description: "Added at checkout when the buyer picks an in person handoff location.",
    unit: "cents",
    percentBps: 0,
    amountCents: 0,
    chargedTo: "buyer",
    chargedWhen: "checkout",
    sort: 100,
    enabled: true,
  },
  {
    id: "sales_tax",
    label: "Sales tax",
    description: "Charged to the buyer at checkout on the asking price. Always shown at checkout, never folded into Rummlee fees. 0% means none added until you set a rate.",
    unit: "percent",
    percentBps: 0,
    amountCents: 0,
    chargedTo: "buyer",
    chargedWhen: "checkout",
    sort: 105,
    enabled: true,
  },
  {
    id: "cancel",
    label: "Cancel after pay",
    description: "Charged if a paid order is cancelled before pickup. $0 means no cancel fee.",
    unit: "cents",
    percentBps: 0,
    amountCents: 0,
    chargedTo: "buyer",
    chargedWhen: "checkout",
    sort: 110,
    enabled: true,
  },
  {
    id: "wallet_topup",
    label: "Wallet top-up",
    description: "Added when credits are added to a wallet. $0 means top-ups are free of a service charge.",
    unit: "percent",
    percentBps: 0,
    amountCents: 0,
    chargedTo: "buyer",
    chargedWhen: "upgrade",
    sort: 120,
    enabled: true,
  },
  {
    id: "location_device",
    label: "Location counter",
    description:
      "Rummlee software on a store’s counter. Hardware is $0 until a location buys a device. Not a buyer or seller fee.",
    unit: "cents",
    percentBps: 0,
    amountCents: 0,
    chargedTo: "none",
    chargedWhen: "upgrade",
    sort: 130,
    enabled: true,
  },
];

export function mapFeeRow(row: {
  id: string;
  label: string;
  description: string;
  unit: string;
  percent_bps: number;
  amount_cents: number;
  charged_to: string;
  charged_when: string;
  sort: number;
  enabled: boolean;
}): FeeRow {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    unit: row.unit as FeeUnit,
    percentBps: Number(row.percent_bps),
    amountCents: Number(row.amount_cents),
    chargedTo: row.charged_to as FeeChargedTo,
    chargedWhen: row.charged_when as FeeWhen,
    sort: Number(row.sort),
    enabled: Boolean(row.enabled),
  };
}

export function feeById(table: FeeRow[], id: string) {
  return table.find((row) => row.id === id && row.enabled) ?? table.find((row) => row.id === id) ?? null;
}

export function percentOf(cents: number, bps: number) {
  return Math.round((cents * bps) / 10000);
}

export function formatFeeValue(row: FeeRow) {
  if (!row.enabled) return "Off";
  if (row.unit === "none" || (row.unit === "percent" && row.percentBps === 0 && row.amountCents === 0) || (row.unit === "cents" && row.amountCents === 0 && row.percentBps === 0)) {
    if (row.unit === "percent" && row.percentBps === 0) return "0%";
    if (row.unit === "cents" && row.amountCents === 0) return "$0";
    return "Free";
  }
  if (row.unit === "percent") {
    const pct = row.percentBps / 100;
    if (Number.isInteger(pct)) return `${pct.toFixed(0)}%`;
    const text = pct.toFixed(2).replace(/0$/, "");
    return `${text}%`;
  }
  if (row.unit === "cents") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: row.amountCents % 100 === 0 ? 0 : 2,
    }).format(row.amountCents / 100);
  }
  return "Free";
}

export function countSaleDays(startsOn: string, endsOn: string) {
  const [ys, ms, ds] = startsOn.split("-").map(Number);
  const [ye, me, de] = endsOn.split("-").map(Number);
  const a = Date.UTC(ys, (ms ?? 1) - 1, ds ?? 1);
  const b = Date.UTC(ye, (me ?? 1) - 1, de ?? 1);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}

export function quoteSaleDays(opts: {
  dayFeeCents: number;
  days: number;
  plus: boolean;
  freeUsed: number;
  /** Null means unlimited free days (Rummlee +++). */
  freePerMonth?: number | null;
}) {
  if (opts.plus && opts.freePerMonth == null) {
    return {
      days: opts.days,
      freeDays: opts.days,
      paidDays: 0,
      chargeCents: 0,
    };
  }
  const cap = opts.freePerMonth ?? 5;
  const freeLeft = opts.plus ? Math.max(0, cap - opts.freeUsed) : 0;
  const freeDays = Math.min(Math.max(0, opts.days), freeLeft);
  const paidDays = Math.max(0, opts.days - freeDays);
  return {
    days: opts.days,
    freeDays,
    paidDays,
    chargeCents: paidDays * (opts.dayFeeCents > 0 ? opts.dayFeeCents : 0),
  };
}

export function minAskingCents(table: FeeRow[]) {
  const row = feeById(table, "min_asking");
  return row?.amountCents && row.amountCents > 0 ? row.amountCents : 500;
}

export type MemberTier = "plus" | "trio" | null;

export type PlusFlags = boolean | { buyer?: boolean; seller?: boolean; sellerTier?: MemberTier };

export function sellerFeeCents(table: FeeRow[], baseCents: number, tier: MemberTier) {
  const fees = table.length ? table : DEFAULT_FEES;
  const floorRow = feeById(fees, "seller_floor");
  const floor = floorRow?.enabled && floorRow.unit === "cents" ? floorRow.amountCents : 0;
  const id = tier === "trio" ? "seller_trio" : tier === "plus" ? "seller_plus" : "seller_payout";
  const row = feeById(fees, id);
  if (!row?.enabled) return floor;
  const amount = row.unit === "percent" ? percentOf(baseCents, row.percentBps) : row.amountCents;
  return Math.max(floor, amount);
}

export type CheckoutQuote = {
  baseCents: number;
  buyerFeeCents: number;
  sellerFeeCents: number;
  handoffFeeCents: number;
  sellerHandoffFeeCents: number;
  salesTaxCents: number;
  feesTotalCents: number;
  youPayCents: number;
  youGetCents: number;
  buyerFeeId: string;
  handoffFeeId: string | null;
  buyerPlus: boolean;
  sellerPlus: boolean;
};

function sellerTierOf(plus: PlusFlags): MemberTier {
  if (typeof plus === "boolean") return null;
  if (plus.sellerTier === "trio" || plus.sellerTier === "plus") return plus.sellerTier;
  if (plus.seller) return "plus";
  return null;
}

function feeAmount(row: FeeRow | null, baseCents: number) {
  if (!row?.enabled) return 0;
  return row.unit === "percent" ? percentOf(baseCents, row.percentBps) : row.amountCents;
}

function plusSides(plus: PlusFlags): { buyer: boolean; seller: boolean; tier: MemberTier } {
  if (typeof plus === "boolean") return { buyer: plus, seller: false, tier: null };
  const tier = sellerTierOf(plus);
  return { buyer: Boolean(plus.buyer), seller: Boolean(plus.seller) || tier != null, tier };
}

export function checkoutQuote(
  table: FeeRow[],
  baseCents: number,
  plus: PlusFlags,
  handoff: "official" | "public" | "person" | "partner" | null,
): CheckoutQuote {
  const fees = table.length ? table : DEFAULT_FEES;
  const sides = plusSides(plus);
  const buyerId = sides.buyer ? "buyer_premium" : "buyer_standard";
  const official = handoff === "official" || handoff === "partner";
  const handId = handoff === "public" ? "public_handoff" : handoff === "person" ? "person_handoff" : official ? "official_handoff" : null;
  const buyerFeeCents = feeAmount(feeById(fees, buyerId), baseCents);
  const sellerTake = sellerFeeCents(fees, baseCents, sides.tier);
  const handoffFeeCents = feeAmount(handId ? feeById(fees, handId) : null, baseCents);
  const sellerHandoffFeeCents = official ? feeAmount(feeById(fees, "official_handoff_seller"), baseCents) : 0;
  const salesTaxCents = feeAmount(feeById(fees, "sales_tax"), baseCents);
  const feesTotalCents = buyerFeeCents + handoffFeeCents;
  return {
    baseCents,
    buyerFeeCents,
    sellerFeeCents: sellerTake,
    handoffFeeCents,
    sellerHandoffFeeCents,
    salesTaxCents,
    feesTotalCents,
    youPayCents: baseCents + feesTotalCents + salesTaxCents,
    youGetCents: baseCents - sellerTake - sellerHandoffFeeCents,
    buyerFeeId: buyerId,
    handoffFeeId: handId,
    buyerPlus: sides.buyer,
    sellerPlus: sides.seller,
  };
}

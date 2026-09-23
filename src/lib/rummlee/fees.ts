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
    description: "Checkout buyer fee when the buyer has Rummlee Plus. 0% — waived. Independent of the official store fee.",
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
    description: "Test-credit price for one month of Rummlee Plus. Waives your $2.99 official store fee when you buy or sell.",
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
    description: "Test-credit price for one year of Rummlee Plus. Same waiver as monthly.",
    unit: "cents",
    percentBps: 0,
    amountCents: 9999,
    chargedTo: "buyer",
    chargedWhen: "upgrade",
    sort: 65,
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
    description: "Charged to the seller for each date a sale runs. Plus includes 3 sale days each calendar month; extra days still pay this. Independently adjustable.",
    unit: "cents",
    percentBps: 0,
    amountCents: 299,
    chargedTo: "seller",
    chargedWhen: "listing",
    sort: 68,
    enabled: true,
  },
  {
    id: "photo_fill",
    label: "Photo fill, seller",
    description: "Suggests a title, category, condition, and haul from the listing photo. Included with Rummlee Plus. Does not set the asking price, the lowest price, or the weight. Off during beta, so this is not charged yet.",
    unit: "cents",
    percentBps: 0,
    amountCents: 99,
    chargedTo: "seller",
    chargedWhen: "listing",
    sort: 69,
    enabled: true,
  },
  {
    id: "seller_payout",
    label: "Seller payout fee",
    description: "Taken from asking when the hold releases. $0 / 0% means the seller receives the full asking price.",
    unit: "percent",
    percentBps: 0,
    amountCents: 0,
    chargedTo: "seller",
    chargedWhen: "checkout",
    sort: 70,
    enabled: true,
  },
  {
    id: "official_handoff",
    label: "Official store, buyer",
    description: "Buyer pays this at checkout for official store handoff, unless they have Rummlee Plus — then it’s waived.",
    unit: "cents",
    percentBps: 0,
    amountCents: 299,
    chargedTo: "buyer",
    chargedWhen: "checkout",
    sort: 80,
    enabled: true,
  },
  {
    id: "official_handoff_seller",
    label: "Official store, seller",
    description: "Taken from the seller’s payout for official store handoff, unless they have Rummlee Plus — then it’s waived.",
    unit: "cents",
    percentBps: 0,
    amountCents: 299,
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
      "Rummlee software on a store’s counter. Hardware is $0 until a device ships — set the price here when you charge for one. Not a buyer or seller fee.",
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
    return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%`;
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
  freePerMonth?: number;
}) {
  const cap = opts.freePerMonth ?? 3;
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

export type PlusFlags = boolean | { buyer?: boolean; seller?: boolean };

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

function plusSides(plus: PlusFlags) {
  if (typeof plus === "boolean") return { buyer: plus, seller: false };
  return { buyer: Boolean(plus.buyer), seller: Boolean(plus.seller) };
}

function feeAmount(row: FeeRow | null, baseCents: number) {
  if (!row?.enabled) return 0;
  return row.unit === "percent" ? percentOf(baseCents, row.percentBps) : row.amountCents;
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
  const sellerFeeCents = feeAmount(feeById(fees, "seller_payout"), baseCents);
  const rawBuyerHandoff = feeAmount(handId ? feeById(fees, handId) : null, baseCents);
  const rawSellerHandoff = official ? feeAmount(feeById(fees, "official_handoff_seller"), baseCents) : 0;
  const handoffFeeCents = official && sides.buyer ? 0 : rawBuyerHandoff;
  const sellerHandoffFeeCents = official && sides.seller ? 0 : rawSellerHandoff;
  const salesTaxCents = feeAmount(feeById(fees, "sales_tax"), baseCents);
  const feesTotalCents = buyerFeeCents + handoffFeeCents;
  return {
    baseCents,
    buyerFeeCents,
    sellerFeeCents,
    handoffFeeCents,
    sellerHandoffFeeCents,
    salesTaxCents,
    feesTotalCents,
    youPayCents: baseCents + feesTotalCents + salesTaxCents,
    youGetCents: baseCents - sellerFeeCents - sellerHandoffFeeCents,
    buyerFeeId: buyerId,
    handoffFeeId: handId,
    buyerPlus: sides.buyer,
    sellerPlus: sides.seller,
  };
}

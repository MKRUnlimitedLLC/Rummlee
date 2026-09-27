import {
  HOLD_LINE,
  HANDOFF_MODES,
  IDENTITY_ENABLED,
  MAX_SALE_DAYS,
  PHOTO_FILL_ENABLED,
  TEST_MODE,
  TEST_PAY_NOTE,
  TRIO_RESEARCHES_PER_MONTH,
  saleDayAllowance,
} from "./constants";
import {
  checkoutQuote,
  feeById,
  formatFeeValue,
  quoteSaleDays,
  sellerFeeCents,
  type FeeRow,
  type MemberTier,
} from "./fees";
import { money } from "./format";

/** The case asking price. Fee dollars are computed from this, never stored. */
export const BANDIT_SAMPLE_CENTS = 42 * 100;

const UNKNOWN = "I do not have that in this build.";

export type BanditNote = { title: string; body: string };

export type BanditTurn = { say: string; note: BanditNote | null };

function norm(raw: string) {
  return raw
    .toLowerCase()
    .replace(/\+\s*\+\s*\+/g, "+++")
    .replace(/[^a-z0-9+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function say(parts: Array<string | false | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part)).join(" ");
}

function feeText(table: FeeRow[], id: string) {
  const row = feeById(table, id);
  return row ? formatFeeValue(row) : "";
}

function sampleQuotes(table: FeeRow[]) {
  const standard = checkoutQuote(table, BANDIT_SAMPLE_CENTS, { buyer: false, seller: false }, "partner");
  const plus = checkoutQuote(table, BANDIT_SAMPLE_CENTS, { buyer: true, seller: true, sellerTier: "plus" }, "partner");
  const trio = checkoutQuote(table, BANDIT_SAMPLE_CENTS, { buyer: true, seller: true, sellerTier: "trio" }, "partner");
  return {
    standard,
    plus,
    trio,
    standardSeller: sellerFeeCents(table, BANDIT_SAMPLE_CENTS, null),
    plusSeller: sellerFeeCents(table, BANDIT_SAMPLE_CENTS, "plus"),
    trioSeller: sellerFeeCents(table, BANDIT_SAMPLE_CENTS, "trio"),
  };
}

function wantsNote(q: string) {
  return /\b(write (it |that |this )?(up|down)|document|a note|the note|pdf|on paper)\b/.test(q);
}

function followUp(q: string) {
  if (!q || q.split(" ").length > 8) return false;
  return /^(and|what about|how about|why|again|seller|buyer|plus|trio|\+\+\+|that|same|the seller|the buyer)\b/.test(q);
}

function topicOf(q: string, prior: string) {
  if (wantsNote(q)) return prior;
  if (!followUp(q) || !prior) return q;
  if (/^(why|again|that|same)\b/.test(q)) return `${prior} ${q}`.replace(/\s+/g, " ").trim();
  return q;
}

function buyerSay(table: FeeRow[]) {
  const q = sampleQuotes(table);
  const buyerRow = feeById(table, q.standard.buyerFeeId);
  const standard = buyerRow
    ? `the standard buyer fee is ${formatFeeValue(buyerRow)}, ${money(q.standard.buyerFeeCents)}`
    : `the standard buyer fee is ${money(q.standard.buyerFeeCents)}`;
  return `On a ${money(BANDIT_SAMPLE_CENTS)} item, ${standard}. Plus is ${money(q.plus.buyerFeeCents)}. +++ is ${money(q.trio.buyerFeeCents)}. Plus or +++ makes the buyer fee zero. It does not waive the seller fee.`;
}

function sellerSay(table: FeeRow[]) {
  const q = sampleQuotes(table);
  const floor = feeById(table, "seller_floor");
  const priced = feeText(table, "seller_payout");
  const lead = priced
    ? `the standard seller fee is ${priced}, ${money(q.standardSeller)}`
    : `the standard seller fee is ${money(q.standardSeller)}`;
  const floorBit = floor ? ` The seller pays ${formatFeeValue(floor)} or the tier percent, whichever is more.` : "";
  return `On a ${money(BANDIT_SAMPLE_CENTS)} item, ${lead}.${floorBit}`;
}

function plusSay(table: FeeRow[]) {
  const row = feeById(table, "premium_switch");
  if (!row) return UNKNOWN;
  return `${row.label} is ${formatFeeValue(row)}. Plus or +++ makes the buyer fee zero. It does not waive the seller fee.`;
}

function handoffSay() {
  const [first, second, third] = HANDOFF_MODES;
  return say([
    first ? `${first.label} first.` : "",
    second ? `${second.label} second.` : "",
    third ? `${third.label} last.` : "",
    "Never a home address on a listing.",
  ]);
}

function pricedAndOff(name: string, table: FeeRow[], id: string, enabled: boolean) {
  const price = feeText(table, id);
  if (!enabled) return price ? `${name} is priced at ${price} and off.` : `${name} is priced and off.`;
  return price ? `${name} is ${price}.` : `${name} is on.`;
}

function saleDaySay(table: FeeRow[]) {
  const row = feeById(table, "sale_day");
  const dayFee = row?.unit === "cents" ? row.amountCents : 0;
  const plusAllowance = saleDayAllowance("plus");
  const trioAllowance = saleDayAllowance("trio");
  const plus = quoteSaleDays({
    dayFeeCents: dayFee,
    days: 1,
    plus: true,
    freeUsed: 0,
    freePerMonth: plusAllowance,
  });
  return say([
    plusAllowance != null ? `Plus includes ${plusAllowance} sale days a month.` : "",
    trioAllowance == null ? "+++ sale days are free." : "",
    `The first Plus sale day this month is ${money(plus.chargeCents)}.`,
    `A sale cannot run longer than ${MAX_SALE_DAYS} days.`,
  ]);
}

function needsLiveTable(q: string) {
  if (!q) return false;
  if (/\bphoto fill\b|\bfill (the |a )?photo\b/.test(q)) return true;
  if (/\bid check\b|\bid verified\b|\bidentity\b|\bverify (my |an )?id\b/.test(q)) return true;
  if (/\bsale day\b/.test(q)) return true;
  if (/\bfeature\b/.test(q)) return true;
  if (/\bresearch/.test(q)) return true;
  if (/\btax\b/.test(q)) return true;
  if (/\bbrowse\b|\blist an item\b|\bminimum\b|\bmin asking\b/.test(q)) return true;
  if (/\bcancel\b/.test(q)) return true;
  if (/\bplus\b|\bpremium\b|\+\+\+|\btrio\b|\bsubscription\b/.test(q)) return true;
  if (/\bbuyer\b|\bseller\b|\bfee\b|\bcost\b|\bprice\b|\bpay\b|\bpercent\b|\bmoney\b|\bhow much\b|\bcheckout\b/.test(q)) {
    return true;
  }
  return false;
}

function speakKnown(q: string, table: FeeRow[]) {
  if (/\bphoto fill\b|\bfill (the |a )?photo\b/.test(q)) {
    return pricedAndOff("Photo fill", table, "photo_fill", PHOTO_FILL_ENABLED);
  }
  if (/\bid check\b|\bid verified\b|\bidentity\b|\bverify (my |an )?id\b/.test(q)) {
    return pricedAndOff("ID check", table, "id_verify", IDENTITY_ENABLED);
  }
  if (/\bwhy\b/.test(q) && /\bbuyer\b|\bfee\b|\bplus\b/.test(q)) {
    return "Plus or +++ makes the buyer fee zero. The seller fee stays.";
  }
  if (/\bhandoff\b|\bstreet\b|\baddress\b|\bpartner\b|\bpublic place\b|\bin person\b|\bprivate\b|\bwhere\b.*\b(meet|pickup|handoff)\b|\b(meet|pickup|handoff)\b.*\bwhere\b/.test(q)) {
    return handoffSay();
  }
  if (/\bheld\b|\bhold\b|\bboth confirm\b|\bconfirm pickup\b|\bpickup\b/.test(q)) {
    return HOLD_LINE;
  }
  if (/\bcard\b|\bstripe\b|\bship\b|\btest credit\b|\breal money\b/.test(q)) {
    return TEST_MODE ? TEST_PAY_NOTE : UNKNOWN;
  }
  if (/\bsale day\b/.test(q)) return saleDaySay(table);
  if (/\bfeature\b/.test(q)) {
    return say([
      feeById(table, "feature_item") ? `Feature an item is ${feeText(table, "feature_item")}.` : "",
      feeById(table, "feature_sale") ? `Feature a sale is ${feeText(table, "feature_sale")}.` : "",
    ]);
  }
  if (/\bresearch/.test(q)) {
    return say([
      feeById(table, "research_ask") ? `Ask a researcher is ${feeText(table, "research_ask")}.` : "",
      `+++ includes ${TRIO_RESEARCHES_PER_MONTH} a month.`,
    ]);
  }
  if (/\btax\b/.test(q)) {
    const tax = feeText(table, "sales_tax");
    return tax ? `Sales tax is ${tax}, its own line at checkout.` : UNKNOWN;
  }
  if (/\bbrowse\b|\blist an item\b|\bminimum\b|\bmin asking\b/.test(q)) {
    if (/\bbrowse\b/.test(q)) return feeById(table, "browse") ? `Browse is ${feeText(table, "browse")}.` : UNKNOWN;
    if (/\bminimum\b|\bmin asking\b/.test(q)) {
      return feeById(table, "min_asking") ? `Minimum asking is ${feeText(table, "min_asking")}.` : UNKNOWN;
    }
    return feeById(table, "list") ? `List an item is ${feeText(table, "list")}.` : UNKNOWN;
  }
  if (/\bcancel\b/.test(q)) {
    const cancel = feeText(table, "cancel");
    return cancel ? `Cancel after pay is ${cancel}.` : UNKNOWN;
  }
  if (/\bplus\b|\bpremium\b|\bsubscription\b/.test(q) && !/\+\+\+|\btrio\b/.test(q)) return plusSay(table);
  if (/\+\+\+|\btrio\b/.test(q)) {
    const month = feeById(table, "trio_month");
    const lead = month ? `${month.label} is ${formatFeeValue(month)}.` : "";
    return say([lead, "+++ makes the buyer fee zero. It does not waive the seller fee."]);
  }
  if (/\bseller\b/.test(q) && !/\bbuyer\b/.test(q)) return sellerSay(table);
  if (/\bbuyer\b|\bfee\b|\bcost\b|\bprice\b|\bpay\b|\bpercent\b|\bmoney\b|\bhow much\b|\bcheckout\b/.test(q)) {
    return buyerSay(table);
  }
  if (/^(hi|hello|hey)\b|\bwho are you\b|\byour name\b|\bbandit\b/.test(q)) {
    return "I'm Bandit. Ask about a fee, then keep talking.";
  }
  if (/\brummlee\b|\bhow does (this|it) work\b|\bwhat is this\b/.test(q)) {
    return "I'm Bandit. Ask me one fee, or where the handoff happens.";
  }
  return "";
}

function noteFor(topic: string, table: FeeRow[]): BanditNote | null {
  const spoken = speakKnown(topic, table);
  if (!spoken || spoken === UNKNOWN) return null;
  const q = sampleQuotes(table);
  const extra =
    /\bbuyer\b|\bfee\b|\bplus\b/.test(topic) && !/\bhandoff\b|\bwhere\b/.test(topic)
      ? say([
          sellerSay(table),
          `Plus seller fee on this item is ${money(q.plusSeller)}.`,
          `+++ seller fee on this item is ${money(q.trioSeller)}.`,
          samePlace(table) ? "The seller fee does not change with the handoff." : "",
        ])
      : "";
  const body = [spoken, extra].filter(Boolean).join("\n\n");
  return { title: "Bandit", body };
}

function samePlace(table: FeeRow[]) {
  const tiers: MemberTier[] = [null, "plus", "trio"];
  const places = ["official", "public", "person", "partner"] as const;
  return tiers.every((tier) => {
    const amounts = places.map(
      (handoff) =>
        checkoutQuote(
          table,
          BANDIT_SAMPLE_CENTS,
          { buyer: false, seller: tier != null, sellerTier: tier },
          handoff,
        ).sellerFeeCents,
    );
    return amounts.every((amount) => amount === amounts[0]);
  });
}

export function banditTurn(question: string, table: FeeRow[] | null, prior?: string | null): BanditTurn {
  const asked = norm(question);
  const before = norm(prior ?? "");
  if (!asked) return { say: "I'm Bandit. Ask about a fee, then keep talking.", note: null };
  if (wantsNote(asked)) {
    const topic = before || asked;
    if (needsLiveTable(topic) && (!table || table.length === 0)) {
      return { say: "I can't read the fee table right now.", note: null };
    }
    const note = noteFor(topic, table ?? []);
    if (!note) return { say: "Ask me first. Then tell me to write it up.", note: null };
    return { say: "I wrote that on a note.", note };
  }
  const q = topicOf(asked, before);
  if (needsLiveTable(q) && (!table || table.length === 0)) return { say: "I can't read the fee table right now.", note: null };
  const spoken = speakKnown(q, table ?? []);
  return { say: spoken || UNKNOWN, note: null };
}

export function answerBandit(question: string, table: FeeRow[] | null, prior?: string | null) {
  return banditTurn(question, table, prior).say;
}

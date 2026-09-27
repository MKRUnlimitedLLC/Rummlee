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

function withTest(parts: Array<string | false | null | undefined>) {
  if (TEST_MODE) parts.push(TEST_PAY_NOTE);
  return say(parts);
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

function sameSellerFee(table: FeeRow[]) {
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

function moneySentences(table: FeeRow[]) {
  const q = sampleQuotes(table);
  const buyerRow = feeById(table, q.standard.buyerFeeId);
  const floor = feeById(table, "seller_floor");
  return [
    `Take a ${money(BANDIT_SAMPLE_CENTS)} item.`,
    buyerRow
      ? `Standard buyer fee is ${formatFeeValue(buyerRow)}, ${money(q.standard.buyerFeeCents)} on this item.`
      : `Standard buyer fee is ${money(q.standard.buyerFeeCents)}.`,
    `Plus buyer fee is ${money(q.plus.buyerFeeCents)}.`,
    `+++ buyer fee is ${money(q.trio.buyerFeeCents)}.`,
    q.plus.buyerFeeCents === 0 && q.trio.buyerFeeCents === 0 ? "Plus or +++ makes the buyer fee zero." : "",
    q.plusSeller > 0 || q.trioSeller > 0 ? "It does not waive the seller fee." : "",
    `Standard seller fee is ${feeText(table, "seller_payout")}, ${money(q.standardSeller)} on this item.`,
    `Plus seller fee is ${feeText(table, "seller_plus")}, ${money(q.plusSeller)} on this item.`,
    `+++ seller fee is ${feeText(table, "seller_trio")}, ${money(q.trioSeller)} on this item.`,
    floor ? `The seller pays ${formatFeeValue(floor)} or the tier percent, whichever is more.` : "",
    sameSellerFee(table) ? "That seller fee is the same for an official store, a public place, and in person." : "",
  ];
}

function planSentences(table: FeeRow[]) {
  const rows = ["premium_switch", "plus_year", "trio_month", "trio_year"]
    .map((id) => feeById(table, id))
    .filter((row): row is FeeRow => Boolean(row));
  return rows.map((row) => `${row.label} is ${formatFeeValue(row)}.`);
}

function pricedAndOff(name: string, table: FeeRow[], id: string, enabled: boolean) {
  const price = feeText(table, id);
  if (!enabled) return price ? `${name} is priced at ${price} and off.` : `${name} is priced and off.`;
  return price ? `${name} is ${price}.` : `${name} is on.`;
}

function handoffAnswer() {
  const [first, second, third] = HANDOFF_MODES;
  return say([
    first ? `${first.label} first.` : "",
    second ? `${second.label} second.` : "",
    third ? `${third.label} last.` : "",
    "The street shows after pay.",
    "Never a home address on a listing.",
    HOLD_LINE,
  ]);
}

function saleDayAnswer(table: FeeRow[]) {
  const row = feeById(table, "sale_day");
  const dayFee = row?.unit === "cents" ? row.amountCents : 0;
  const standard = quoteSaleDays({
    dayFeeCents: dayFee,
    days: 1,
    plus: false,
    freeUsed: 0,
    freePerMonth: saleDayAllowance(null),
  });
  const plus = quoteSaleDays({
    dayFeeCents: dayFee,
    days: 1,
    plus: true,
    freeUsed: 0,
    freePerMonth: saleDayAllowance("plus"),
  });
  const trioAllowance = saleDayAllowance("trio");
  const plusAllowance = saleDayAllowance("plus");
  return say([
    plusAllowance != null ? `Plus includes ${plusAllowance} sale days a month.` : "",
    trioAllowance == null ? "+++ sale days are free." : "",
    `One Standard sale day is ${money(standard.chargeCents)}.`,
    `The first Plus sale day this month is ${money(plus.chargeCents)}.`,
    row ? `A paid sale day is ${formatFeeValue(row)}.` : "",
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
  if (/\bhandoff\b|\bstreet\b|\baddress\b|\bpartner\b|\bpublic place\b|\bin person\b|\bprivate\b|\bwhere\b.*\b(meet|pickup|handoff)\b|\b(meet|pickup|handoff)\b.*\bwhere\b/.test(q)) {
    return handoffAnswer();
  }
  if (/\bheld\b|\bhold\b|\bboth confirm\b|\bconfirm pickup\b|\bpickup\b/.test(q)) {
    return HOLD_LINE;
  }
  if (/\bcard\b|\bstripe\b|\bship\b|\btest credit\b|\breal money\b/.test(q)) {
    return TEST_MODE ? TEST_PAY_NOTE : UNKNOWN;
  }
  if (/\bsale day\b/.test(q)) return saleDayAnswer(table);
  if (/\bfeature\b/.test(q)) {
    return say([
      feeById(table, "feature_item") ? `Feature an item is ${feeText(table, "feature_item")}.` : "",
      feeById(table, "feature_sale") ? `Feature a sale is ${feeText(table, "feature_sale")}.` : "",
      "Both run until the sale ends.",
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
    return tax ? `Sales tax is ${tax}. It is its own line at checkout.` : UNKNOWN;
  }
  if (/\bbrowse\b|\blist an item\b|\bminimum\b|\bmin asking\b/.test(q)) {
    return say([
      feeById(table, "browse") ? `Browse is ${feeText(table, "browse")}.` : "",
      feeById(table, "list") ? `List an item is ${feeText(table, "list")}.` : "",
      feeById(table, "min_asking") ? `Minimum asking is ${feeText(table, "min_asking")}.` : "",
    ]);
  }
  if (/\bcancel\b/.test(q)) {
    const cancel = feeText(table, "cancel");
    return cancel ? `Cancel after pay is ${cancel}.` : UNKNOWN;
  }
  if (/\bplus\b|\bpremium\b|\+\+\+|\btrio\b|\bsubscription\b/.test(q)) {
    return withTest([...planSentences(table), ...moneySentences(table)]);
  }
  if (/\bbuyer\b|\bseller\b|\bfee\b|\bcost\b|\bprice\b|\bpay\b|\bpercent\b|\bmoney\b|\bhow much\b|\bcheckout\b/.test(q)) {
    return withTest(moneySentences(table));
  }
  if (/^(hi|hello|hey)\b|\bwho are you\b|\byour name\b|\bbandit\b/.test(q)) {
    return "I'm Bandit. Ask me about a fee, a handoff, or pickup.";
  }
  if (/\brummlee\b|\bhow does (this|it) work\b|\bwhat is this\b/.test(q)) {
    return say([
      "I'm Bandit. I teach Rummlee from this build.",
      handoffAnswer(),
      TEST_MODE ? TEST_PAY_NOTE : "",
    ]);
  }
  return "";
}

export function answerBandit(question: string, table: FeeRow[] | null) {
  const q = norm(question);
  if (!q) return "I'm Bandit. Ask me about a fee, a handoff, or pickup.";
  if (needsLiveTable(q) && (!table || table.length === 0)) return "I can't read the fee table right now.";
  const spoken = speakKnown(q, table ?? []);
  return spoken || UNKNOWN;
}

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { HOLD_LINE, TEST_MODE, TEST_PAY_NOTE } from "@/lib/rummlee/constants";
import { checkoutQuote, type FeeRow, type MemberTier } from "@/lib/rummlee/fees";
import { money } from "@/lib/rummlee/format";
import { cn } from "@/lib/utils";

/** Listing price only — fees live on /fees and at checkout. */
export function AskingPrice({ cents, originalCents }: { cents: number; originalCents?: number | null }) {
  return (
    <div className="space-y-1">
      <p className="font-display text-3xl font-semibold tracking-[-0.03em] text-primary-ink">{money(cents)}</p>
      {originalCents != null && originalCents > cents ? (
        <p className="text-sm text-subtle">
          Was <span className="line-through">{money(originalCents)}</span>
        </p>
      ) : null}
      <p className="text-sm font-medium text-primary-ink">{HOLD_LINE}</p>
    </div>
  );
}

/** Checkout only: asking, fees as a total (expand for detail), sales tax always visible. */
export function CheckoutPay({
  baseCents,
  premium,
  sellerPlus = false,
  sellerTier = null,
  fees,
  handoff,
  priceLabel = "Asking",
}: {
  baseCents: number;
  premium: boolean;
  sellerPlus?: boolean;
  sellerTier?: MemberTier;
  fees: FeeRow[];
  handoff: "official" | "public" | "person" | "partner";
  priceLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const quote = checkoutQuote(fees, baseCents, { buyer: premium, sellerTier: sellerTier ?? (sellerPlus ? "plus" : null) }, handoff);
  const buyer = fees.find((row) => row.id === quote.buyerFeeId);
  const hand = quote.handoffFeeId ? fees.find((row) => row.id === quote.handoffFeeId) : null;
  const taxRow = fees.find((row) => row.id === "sales_tax");
  return (
    <div className="space-y-2 rounded-2xl bg-bg px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-primary-ink">Checkout</p>
      <p className="flex justify-between text-sm">
        <span className="text-muted">{priceLabel}</span>
        <span className="tabular-nums">{money(quote.baseCents)}</span>
      </p>
      <p className="flex justify-between text-sm">
        <span className="text-muted">Fees</span>
        <span className="tabular-nums">{money(quote.feesTotalCents)}</span>
      </p>
      {quote.feesTotalCents > 0 ? (
        <p className="text-sm text-muted">
          {[
            quote.buyerFeeCents > 0 ? `${buyer?.unit === "percent" ? `${(buyer.percentBps / 100).toFixed(buyer.percentBps % 100 === 0 ? 0 : 1)}%` : money(quote.buyerFeeCents)} buyer` : premium ? "Buyer fee $0 with Plus" : null,
          ]
            .filter(Boolean)
            .join(" + ") || "See details"}
        </p>
      ) : null}
      <button
        type="button"
        className="text-sm font-medium text-primary-ink"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "Hide fee details" : "See fee details"}
      </button>
      {open ? (
        <div className="space-y-1.5 rounded-xl bg-surface px-3 py-2">
          <p className="flex justify-between text-sm">
            <span className="text-muted">{buyer?.label ?? "Buyer fee"}</span>
            <span className="tabular-nums">{money(quote.buyerFeeCents)}</span>
          </p>
          {quote.sellerFeeCents > 0 ? (
            <p className="flex justify-between text-sm">
              <span className="text-muted">Seller fee, from their payout</span>
              <span className="tabular-nums text-muted">{money(quote.sellerFeeCents)}</span>
            </p>
          ) : null}
          {quote.handoffFeeCents > 0 ? (
            <p className="flex justify-between text-sm">
              <span className="text-muted">{hand?.label ?? "Handoff"}</span>
              <span className="tabular-nums">{money(quote.handoffFeeCents)}</span>
            </p>
          ) : null}
          <p className="text-sm text-muted">
            The seller fee is the same for an official store, a public place, or in person. Plus and +++ remove the buyer fee. They do not remove the seller fee.{" "}
            <Link to="/fees" className="font-medium text-primary-ink">
              See tiers
            </Link>
          </p>
        </div>
      ) : null}
      {!premium ? (
        <p className="text-sm text-muted">
          Plus and +++ make the buyer fee $0. The seller still pays $2.99 or their tier percent, whichever is more.{" "}
          <Link to="/you" className="font-medium text-primary-ink">
            See Plus
          </Link>
        </p>
      ) : null}
      <p className="flex justify-between text-sm font-medium">
        <span>Sales tax</span>
        <span className="tabular-nums">{money(quote.salesTaxCents)}</span>
      </p>
      <p className="text-sm text-muted">
        {quote.salesTaxCents > 0
          ? "On asking, at this handoff. Not a Rummlee fee."
          : taxRow?.enabled
            ? "None on this beta listing. A rate will show here when tax applies — never mixed into fees."
            : "Not charged on this handoff."}
      </p>
      <p className="flex justify-between font-display text-xl font-semibold tracking-[-0.03em] text-primary-ink">
        <span>{TEST_MODE ? "You pay (test)" : "You pay"}</span>
        <span className="tabular-nums">{money(quote.youPayCents)}</span>
      </p>
      <p className="text-sm font-medium text-primary-ink">{HOLD_LINE}</p>
      <p className="text-sm text-muted">Cancel before pickup and the test hold comes back. Nothing is final until both of you confirm.</p>
      {TEST_MODE ? <p className="text-sm text-muted">{TEST_PAY_NOTE}</p> : null}
      <SplitHint youPayCents={quote.youPayCents} />
      <p className="text-sm text-muted">
        <Link to="/fees" className="font-medium text-primary-ink">
          All fees
        </Link>
      </p>
    </div>
  );
}

function SplitHint({ youPayCents }: { youPayCents: number }) {
  const [open, setOpen] = useState(false);
  const each = Math.round(youPayCents / 2);
  return (
    <div className="text-sm">
      <button type="button" className="font-medium text-primary-ink" onClick={() => setOpen((v) => !v)}>
        Estimate a split — you still pay the full amount here
      </button>
      {open ? (
        <p className="mt-1 text-muted">
          About {money(each)} each if two of you. Share this listing — same hold. You still pay the full test total
          here; split the rest off-app.
        </p>
      ) : null}
    </div>
  );
}

export function FeeLine({
  baseCents,
  premium = false,
  className,
}: {
  baseCents: number;
  premium?: boolean;
  agreed?: boolean;
  className?: string;
}) {
  const quote = checkoutQuote([], baseCents, premium, "official");
  return (
    <p className={cn("text-sm leading-snug text-muted", className)}>
      Asking {money(quote.baseCents)}
    </p>
  );
}

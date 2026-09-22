import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { HOLD_LINE, TEST_MODE, TEST_PAY_NOTE } from "@/lib/rummlee/constants";
import { checkoutQuote, type FeeRow } from "@/lib/rummlee/fees";
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

/** Checkout only: asking, each fee, You pay. */
export function CheckoutPay({
  baseCents,
  premium,
  fees,
  handoff,
}: {
  baseCents: number;
  premium: boolean;
  fees: FeeRow[];
  handoff: "official" | "public" | "person" | "partner";
}) {
  const quote = checkoutQuote(fees, baseCents, premium, handoff);
  const buyer = fees.find((row) => row.id === quote.buyerFeeId);
  const hand = quote.handoffFeeId ? fees.find((row) => row.id === quote.handoffFeeId) : null;
  return (
    <div className="space-y-2 rounded-2xl bg-bg px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-primary-ink">Checkout</p>
      <p className="flex justify-between text-sm">
        <span className="text-muted">Asking</span>
        <span className="tabular-nums">{money(quote.baseCents)}</span>
      </p>
      {quote.buyerFeeCents > 0 ? (
        <p className="flex justify-between text-sm">
          <span className="text-muted">{buyer?.label ?? "Buyer fee"}</span>
          <span className="tabular-nums">{money(quote.buyerFeeCents)}</span>
        </p>
      ) : null}
      {quote.handoffFeeCents > 0 ? (
        <p className="flex justify-between text-sm">
          <span className="text-muted">{hand?.label ?? "Handoff"}</span>
          <span className="tabular-nums">{money(quote.handoffFeeCents)}</span>
        </p>
      ) : null}
      <p className="flex justify-between font-display text-xl font-semibold tracking-[-0.03em] text-primary-ink">
        <span>{TEST_MODE ? "You pay (test)" : "You pay"}</span>
        <span className="tabular-nums">{money(quote.youPayCents)}</span>
      </p>
      <p className="text-sm font-medium text-primary-ink">{HOLD_LINE}</p>
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
        Split this with someone
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

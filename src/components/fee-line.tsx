import { HOLD_LINE } from "@/lib/rummlee/constants";
import { money, payQuote } from "@/lib/rummlee/format";
import { cn } from "@/lib/utils";

/** Glance price for a card: You pay is the hero. Asking and fee stay on the same line. */
export function CardPay({ baseCents, premium = false }: { baseCents: number; premium?: boolean }) {
  const standard = payQuote(baseCents, false);
  const prem = payQuote(baseCents, true);
  const hero = premium ? prem : standard;
  return (
    <div className="space-y-1">
      <p className="font-display text-2xl font-semibold tracking-[-0.03em] text-primary-ink">
        You pay {money(hero.youPayCents)}
      </p>
      <p className="text-sm leading-snug text-muted">
        Asking {money(standard.baseCents)}
        <span className="text-subtle"> · </span>
        Fee {money(hero.feeCents)}
        <span className="text-subtle"> · </span>
        {premium ? `Standard ${money(standard.youPayCents)}` : `Premium you pay ${money(prem.youPayCents)}`}
      </p>
      <p className="text-sm font-medium text-primary-ink">{HOLD_LINE}</p>
    </div>
  );
}

/** Detail page: You pay leads. Asking, fee, and Premium total follow. */
export function PdpPay({
  baseCents,
  premium = false,
  originalCents,
}: {
  baseCents: number;
  premium?: boolean;
  originalCents?: number | null;
}) {
  const standard = payQuote(baseCents, false);
  const prem = payQuote(baseCents, true);
  const hero = premium ? prem : standard;
  return (
    <div className="space-y-1">
      <p className="font-display text-3xl font-semibold tracking-[-0.03em] text-primary-ink">
        You pay {money(hero.youPayCents)}
      </p>
      <p className="text-sm leading-snug text-fg">
        Asking {money(standard.baseCents)}
        <span className="text-muted"> · </span>
        Fee {money(hero.feeCents)}
        <span className="text-muted"> · </span>
        {premium ? `Standard ${money(standard.youPayCents)}` : `Premium you pay ${money(prem.youPayCents)}`}
      </p>
      {originalCents != null && originalCents > baseCents ? (
        <p className="text-sm text-subtle">
          Was <span className="line-through">{money(originalCents)}</span>
        </p>
      ) : null}
      <p className="text-sm font-medium text-primary-ink">{HOLD_LINE}</p>
    </div>
  );
}

/** Asking, fee, and total from one base — 10%, or 5% when the buyer has Premium. */
export function FeeLine({
  baseCents,
  premium = false,
  agreed = false,
  className,
}: {
  baseCents: number;
  premium?: boolean;
  agreed?: boolean;
  className?: string;
}) {
  const quote = payQuote(baseCents, premium);
  const label = agreed ? "Agreed" : "Asking";
  return (
    <p className={cn("text-sm leading-snug text-muted", className)}>
      <span className="whitespace-nowrap font-medium text-fg">You pay {money(quote.youPayCents)}</span>
      <span className="text-subtle"> · </span>
      <span className="whitespace-nowrap">
        {label} {money(quote.baseCents)}
      </span>
      <span className="text-subtle"> · </span>
      <span className="whitespace-nowrap">Fee {money(quote.feeCents)}</span>
    </p>
  );
}

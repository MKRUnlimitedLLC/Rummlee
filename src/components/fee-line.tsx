import { money, payQuote } from "@/lib/rummlee/format";
import { cn } from "@/lib/utils";

/** Glance price for a card: You pay is the hero. Asking and fee stay on the same line. */
export function CardPay({ baseCents, premium = false }: { baseCents: number; premium?: boolean }) {
  const standard = payQuote(baseCents, false);
  const prem = payQuote(baseCents, true);
  const hero = premium ? prem : standard;
  return (
    <div className="space-y-0.5">
      <p className="font-display text-xl font-semibold tracking-[-0.03em] text-primary-ink">
        You pay {money(hero.youPayCents)}
      </p>
      <p className="text-sm leading-snug text-fg">
        Asking {money(standard.baseCents)}
        <span className="text-muted"> · </span>
        Fee {money(hero.feeCents)}
        <span className="text-muted"> · </span>
        <span className="text-muted">{premium ? `Standard ${money(standard.youPayCents)}` : `Premium ${money(prem.youPayCents)}`}</span>
      </p>
      <p className="text-sm font-medium text-primary-ink">Held until you both confirm</p>
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
      <span className="whitespace-nowrap">
        {label} {money(quote.baseCents)}
      </span>
      <span className="text-subtle"> · </span>
      <span className="whitespace-nowrap">Fee {money(quote.feeCents)}</span>
      <span className="text-subtle"> · </span>
      <span className="whitespace-nowrap font-medium text-fg">You pay {money(quote.youPayCents)}</span>
    </p>
  );
}

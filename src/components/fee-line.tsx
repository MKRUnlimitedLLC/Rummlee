import { money, payQuote } from "@/lib/rummlee/format";
import { cn } from "@/lib/utils";

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

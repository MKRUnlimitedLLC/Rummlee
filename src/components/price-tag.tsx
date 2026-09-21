import { money } from "@/lib/rummlee/format";
import { cn } from "@/lib/utils";

export function PriceTag({
  cents,
  original,
  className,
  size = "md",
}: {
  cents: number;
  original?: number | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5 tabular-nums", className)}>
      <span
        className={cn(
          "font-display font-semibold tracking-[-0.03em] text-primary-ink",
          size === "sm" && "text-base",
          size === "md" && "text-lg",
          size === "lg" && "text-3xl",
        )}
      >
        {money(cents)}
      </span>
      {original != null && original > cents ? (
        <span className="text-sm text-subtle line-through">{money(original)}</span>
      ) : null}
    </span>
  );
}

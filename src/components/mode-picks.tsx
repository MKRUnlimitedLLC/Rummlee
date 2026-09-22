import { HANDOFF_MODES } from "@/lib/rummlee/constants";
import { splitModes } from "@/lib/rummlee/format";
import type { HandoffMode } from "@/lib/rummlee/types";
import { cn } from "@/lib/utils";

/** Seller chooses which handoff locations to offer — one, two, or all three. */
export function ModePicks({
  value,
  onChange,
}: {
  value: HandoffMode[];
  onChange: (modes: HandoffMode[]) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">Handoff locations you offer</p>
      <p className="mb-2 text-sm text-muted">Pick any or all. Neighbors only see what you turn on. A home address never goes on the listing.</p>
      <div className="space-y-2">
        {HANDOFF_MODES.map((row, index) => {
          const on = value.includes(row.id);
          return (
            <button
              key={row.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const next = on ? value.filter((id) => id !== row.id) : [...value, row.id];
                if (!next.length) return;
                onChange(splitModes(next.join(",")));
              }}
              className={cn(
                "flex w-full flex-col items-start rounded-2xl px-4 py-3 text-left",
                on ? "bg-primary-soft text-fg" : "bg-surface text-muted shadow-[0_0_0_1px_rgba(22,20,18,0.08)]",
              )}
            >
              <span className="text-sm font-medium text-fg">
                {index + 1}. {row.label}
              </span>
              <span className="mt-0.5 text-sm text-muted">{row.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

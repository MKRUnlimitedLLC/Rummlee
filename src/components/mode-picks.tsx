import { splitModes } from "@/lib/rummlee/format";
import type { HandoffMode } from "@/lib/rummlee/types";
import { cn } from "@/lib/utils";

const ROWS: { id: HandoffMode; label: string; hint: string; badge: string | null; locked: boolean }[] = [
  {
    id: "official",
    label: "Partner store",
    hint: "Default. Locker or pickup desk, store hours.",
    badge: "Default",
    locked: true,
  },
  {
    id: "public",
    label: "Public place",
    hint: "Backup. Park, library, or civic lot. Still no home address.",
    badge: "Backup",
    locked: false,
  },
  {
    id: "porch",
    label: "Person to person",
    hint: "Optional. Still a handle — still no home address.",
    badge: null,
    locked: false,
  },
];

/** Partner stays on. Public and person to person are real selectable modes. */
export function ModePicks({
  value,
  onChange,
}: {
  value: HandoffMode[];
  onChange: (modes: HandoffMode[]) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">How you hand off</p>
      <div className="space-y-2">
        {ROWS.map((row, index) => {
          const on = row.locked || value.includes(row.id);
          return (
            <button
              key={row.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                if (row.locked) return;
                const next = on ? value.filter((id) => id !== row.id) : [...value, row.id];
                const withPartner = next.includes("official") ? next : (["official", ...next] as HandoffMode[]);
                onChange(splitModes(withPartner.join(",")));
              }}
              className={cn(
                "flex w-full flex-col items-start rounded-2xl px-4 py-3 text-left",
                on ? "bg-primary-soft text-fg" : "bg-surface text-muted shadow-[0_0_0_1px_rgba(22,20,18,0.08)]",
              )}
            >
              <span className="text-sm font-medium text-fg">
                {index + 1}. {row.label}
                {row.badge ? <span className="text-sm font-medium text-primary-ink"> · {row.badge}</span> : null}
              </span>
              <span className="mt-0.5 text-sm text-muted">{row.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

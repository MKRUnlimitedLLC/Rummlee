import { useEffect, useState } from "react";
import { applyReading, currentReading, readingWasAsked, paintReading, type Reading } from "@/lib/rummlee/reading";
import { cn } from "@/lib/utils";

export function ReadingAsk({ placement = "overlay" }: { placement?: "overlay" | "flow" }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    paintReading(currentReading());
    if (!readingWasAsked()) setOpen(true);
  }, []);
  if (!open) return null;
  function choose(mode: Reading) {
    applyReading(mode);
    setOpen(false);
  }
  return (
    <div
      className={
        placement === "flow"
          ? "relative z-0 mb-4 w-full max-w-lg"
          : "fixed inset-x-0 bottom-24 z-50 mx-auto w-full max-w-lg px-4 md:bottom-6"
      }
      role="dialog"
      aria-labelledby="reading-title"
    >
      <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
        <p id="reading-title" className="text-base font-medium">How should this look?</p>
        <p className="mt-1 text-sm text-muted">Larger text is easier to read. This stays on this phone. Change it anytime at the top, or on You.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="min-h-11 rounded-xl bg-fg px-3 text-sm font-medium text-primary-fg" onClick={() => choose("simple")}>
            Larger text
          </button>
          <button type="button" className="min-h-11 rounded-xl bg-bg-warm px-3 text-sm font-medium text-fg" onClick={() => choose("full")}>
            Regular text
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReadingChoice() {
  const [mode, setMode] = useState<Reading>("full");
  useEffect(() => {
    const sync = () => setMode(currentReading());
    sync();
    window.addEventListener("rummlee-reading", sync);
    return () => window.removeEventListener("rummlee-reading", sync);
  }, []);
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        aria-pressed={mode === "simple"}
        className={cn(
          "min-h-11 rounded-xl px-3 text-sm font-medium",
          mode === "simple" ? "bg-fg text-primary-fg" : "bg-bg-warm text-fg",
        )}
        onClick={() => applyReading("simple")}
      >
        Larger text
      </button>
      <button
        type="button"
        aria-pressed={mode === "full"}
        className={cn(
          "min-h-11 rounded-xl px-3 text-sm font-medium",
          mode === "full" ? "bg-fg text-primary-fg" : "bg-bg-warm text-fg",
        )}
        onClick={() => applyReading("full")}
      >
        Regular text
      </button>
    </div>
  );
}

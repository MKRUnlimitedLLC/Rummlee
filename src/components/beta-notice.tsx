import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TEST_MODE } from "@/lib/rummlee/constants";

/** Extra first-visit dialog. The header banner is the one that always paints, including on first HTML. */
const KEY = "rummlee.betaNotice.v2";

export function BetaNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!TEST_MODE) return;
    try {
      if (localStorage.getItem(KEY) === "ok") return;
    } catch {
      /* private mode — still show */
    }
    setOpen(true);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(KEY, "ok");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!TEST_MODE || !open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-fg/40 p-4 sm:items-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="beta-title"
        aria-describedby="beta-body"
        className="w-full max-w-md rounded-[24px] bg-surface p-6 shadow-[var(--shadow-card)]"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-primary-ink">Beta</p>
        <h2 id="beta-title" className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em]">
          We’re currently in testing
        </h2>
        <p id="beta-body" className="mt-3 text-pretty text-[15px] leading-relaxed text-muted">
          No real items are listed for sale. What you see is sample inventory so you can try the product. Pay uses test
          credits — not real money. Nothing ships. Meet-ups are simulated.
        </p>
        <Button className="mt-6 w-full" onClick={dismiss} autoFocus>
          I understand
        </Button>
      </div>
    </div>
  );
}

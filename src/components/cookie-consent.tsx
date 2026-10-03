import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { chooseConsent, currentConsent } from "@/lib/rummlee/measure-browser";

export function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(currentConsent() === null);
  }, []);

  function choose(choice: "essential" | "all") {
    chooseConsent(choice);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookies"
      className="fixed inset-x-3 z-50 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)] bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4 md:left-auto md:right-4 md:max-w-sm"
    >
      <p className="text-sm text-fg">
        Essential cookies keep you signed in. Measurement is optional. If you allow it, we count the visit and a signup. We do not follow you on other sites.
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <Link to="/privacy" className="px-2 text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
          Privacy
        </Link>
        <Button type="button" variant="secondary" size="sm" onClick={() => choose("essential")}>
          Essential only
        </Button>
        <Button type="button" size="sm" onClick={() => choose("all")}>
          Allow measurement
        </Button>
      </div>
    </div>
  );
}

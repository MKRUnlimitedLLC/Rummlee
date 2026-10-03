import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const KEY = "rummlee.cookies.v1";

export function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "necessary") return;
    } catch {
      /* private mode */
    }
    setOpen(true);
  }, []);

  function ok() {
    try {
      localStorage.setItem(KEY, "necessary");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookies"
      className="fixed inset-x-3 z-50 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)] bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4 md:left-auto md:right-4 md:max-w-sm"
    >
      <p className="text-sm text-fg">Rummlee uses one session cookie to keep you signed in. No advertising cookies.</p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Link to="/privacy" className="px-2 text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
          Privacy
        </Link>
        <Button type="button" size="sm" onClick={ok}>
          OK
        </Button>
      </div>
    </div>
  );
}

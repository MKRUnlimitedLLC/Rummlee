import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { TEST_MODE } from "@/lib/rummlee/constants";
import { capturePageUtm } from "@/lib/rummlee/utm-session";
import { HandoffForm, WaitlistForm } from "./launch-forms";

const KEY = "rummlee.launchList.v2";

function remembered() {
  try {
    const now = localStorage.getItem(KEY);
    if (now) return now;
    if (localStorage.getItem("rummlee.launchList.v1") === "joined") return "joined";
    return null;
  } catch {
    return null;
  }
}

export function LaunchSignup() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"waitlist" | "handoff">("waitlist");
  const onHandoffPage = useRouterState({
    select: (s) => s.location.pathname === "/handoff",
  });
  const href = useRouterState({ select: (s) => s.location.href });

  useEffect(() => {
    capturePageUtm();
  }, [href]);

  useEffect(() => {
    if (!TEST_MODE || remembered() || onHandoffPage) return;
    const timer = window.setTimeout(() => {
      if (!remembered()) setOpen(true);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [onHandoffPage]);

  function close(value: "ok" | "joined") {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* private mode */
    }
    setOpen(false);
  }

  if (!TEST_MODE || !open || onHandoffPage) return null;

  const handoff = mode === "handoff";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto bg-fg/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-title"
        aria-describedby="launch-body"
        className="my-auto max-h-[min(40rem,calc(100dvh-2rem))] w-full max-w-md overflow-y-auto rounded-[24px] bg-surface p-6 shadow-[var(--shadow-card)]"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-primary-ink">
          {handoff ? "Stores" : "Launching soon"}
        </p>
        <h2
          id="launch-title"
          className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em]"
        >
          {handoff ? "Be an official store" : "Be the first to sign up"}
        </h2>
        <p
          id="launch-body"
          className="mt-3 text-pretty text-[15px] leading-relaxed text-muted"
        >
          {handoff
            ? "Tell us about the shop. We’ll write if it fits a city we’re opening. No fee to ask, and no promise of exclusivity, payment, or a go-live date."
            : "Rummlee launches soon. Leave an email and you’ll hear when real items go live in your city. What you see now is a sample. Nothing is for sale, and no card is charged."}
        </p>
        {handoff ? (
          <div className="mt-5">
            <HandoffForm
              idPrefix="launch-handoff"
              onSuccess={(message) => {
                toast.success(message);
                setMode("waitlist");
              }}
            />
            <button
              type="button"
              className="mt-3 w-full text-sm font-medium text-primary-ink"
              onClick={() => setMode("waitlist")}
            >
              Back to the list
            </button>
          </div>
        ) : (
          <>
            <WaitlistForm
              idPrefix="launch"
              onSuccess={(message) => {
                close("joined");
                toast.success(message);
              }}
            />
            <button
              type="button"
              className="mt-3 w-full text-sm font-medium text-primary-ink"
              onClick={() => setMode("handoff")}
            >
              Be an official store
            </button>
          </>
        )}
        <button
          type="button"
          className="mt-3 w-full text-sm font-medium text-muted"
          onClick={() => close("ok")}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

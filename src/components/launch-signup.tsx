import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errMessage } from "@/lib/rummlee/errors";
import { TEST_MODE } from "@/lib/rummlee/constants";
import { joinLaunchList } from "@/lib/rummlee/launch-list";

const KEY = "rummlee.launchList.v1";
const BETA_KEY = "rummlee.betaNotice.v2";

function remembered() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function betaStillOpen() {
  if (!TEST_MODE) return false;
  try {
    return localStorage.getItem(BETA_KEY) !== "ok";
  } catch {
    return false;
  }
}

export function LaunchSignup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!TEST_MODE || remembered()) return;
    function show() {
      if (remembered() || betaStillOpen()) return;
      setOpen(true);
    }
    if (!betaStillOpen()) {
      const timer = window.setTimeout(show, 700);
      return () => window.clearTimeout(timer);
    }
    window.addEventListener("rummlee-beta-dismissed", show);
    return () => window.removeEventListener("rummlee-beta-dismissed", show);
  }, []);

  function close(value: "ok" | "joined") {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* private mode */
    }
    setOpen(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await joinLaunchList({ data: { email, company } });
      close("joined");
      toast.success("You’re on the list. We’ll write when it’s live.");
    } catch (error) {
      toast.error(errMessage(error));
    } finally {
      setPending(false);
    }
  }

  if (!TEST_MODE || !open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-fg/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-title"
        aria-describedby="launch-body"
        className="w-full max-w-md rounded-[24px] bg-surface p-6 shadow-[var(--shadow-card)]"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-primary-ink">Going live</p>
        <h2 id="launch-title" className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em]">
          Get a note when Rummlee opens
        </h2>
        <p id="launch-body" className="mt-3 text-pretty text-[15px] leading-relaxed text-muted">
          One email when real listings open. Nothing else. We don’t sell the address.
        </p>
        <form className="mt-5" onSubmit={submit}>
          <label className="sr-only" htmlFor="launch-email">
            Email
          </label>
          <Input
            id="launch-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoFocus
          />
          <input
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute h-0 w-0 opacity-0"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
          <Button className="mt-3 w-full" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Notify me"}
          </Button>
        </form>
        <button type="button" className="mt-3 w-full text-sm font-medium text-muted" onClick={() => close("ok")}>
          Not now
        </button>
      </div>
    </div>
  );
}

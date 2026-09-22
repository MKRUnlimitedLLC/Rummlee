import { Link, getRouteApi, useRouterState } from "@tanstack/react-router";
import { Inbox, Home, Plus, CalendarDays, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Wordmark } from "./logo";
import { BetaNotice } from "./beta-notice";
import { cn } from "@/lib/utils";
import { TEST_MODE, TEST_PAY_NOTE } from "@/lib/rummlee/constants";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const TABS = [
  { to: "/", label: "Browse", icon: Home, match: (p: string) => p === "/" || (p.startsWith("/listings") && p !== "/listings/new") },
  { to: "/sales", label: "Sales", icon: CalendarDays, match: (p: string) => p.startsWith("/sales") },
  { to: "/listings/new", label: "Sell", icon: Plus, match: (p: string) => p.startsWith("/sell") || p === "/listings/new" },
  { to: "/inbox", label: "Inbox", icon: Inbox, match: (p: string) => p.startsWith("/inbox") || p.startsWith("/pickup") },
  { to: "/you", label: "You", icon: UserRound, match: (p: string) => p.startsWith("/you") || p.startsWith("/login") },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideNav = pathname.startsWith("/login");
  const [large, setLarge] = useState(false);
  useEffect(() => {
    const on = localStorage.getItem("rummlee.largeType") === "1";
    setLarge(on);
    document.documentElement.classList.toggle("rummlee-large", on);
  }, []);
  function toggleLarge() {
    const next = !large;
    setLarge(next);
    localStorage.setItem("rummlee.largeType", next ? "1" : "0");
    document.documentElement.classList.toggle("rummlee-large", next);
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="min-h-11 min-w-11 content-center">
            <Wordmark />
          </Link>
          <button type="button" className="text-sm font-medium text-muted" onClick={toggleLarge}>
            {large ? "Regular text" : "Large text"}
          </button>
          <nav className="hidden items-center gap-1 md:flex">
            {TABS.filter((t) => t.to !== "/you").map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-3 text-sm font-medium",
                  tab.match(pathname) ? "bg-fg text-primary-fg" : "text-muted hover:bg-bg-warm",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <AuthChip />
        </div>
        {TEST_MODE ? (
          <p className="border-t border-border/60 bg-primary-soft px-4 py-1.5 text-center text-xs font-medium text-primary-ink">
            {TEST_PAY_NOTE}
          </p>
        ) : null}
      </header>
      <div className={cn("mx-auto w-full max-w-5xl px-4", hideNav ? "pb-8" : "pb-28 md:pb-10")}>{children}</div>
      {hideNav ? null : (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
          <ul className="mx-auto grid max-w-lg grid-cols-5 px-2 pt-1">
            {TABS.map((tab) => {
              const active = tab.match(pathname);
              const Icon = tab.icon;
              const sell = tab.to === "/listings/new";
              return (
                <li key={tab.to}>
                  <Link
                    to={tab.to}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center gap-0.5 text-sm font-medium",
                      active ? "text-primary-ink" : "text-muted",
                    )}
                  >
                    {sell ? (
                      <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-fg shadow-[0_1px_0_rgba(28,25,21,0.12)]">
                        <Icon className="size-4" strokeWidth={2.2} />
                      </span>
                    ) : (
                      <Icon className="size-5" strokeWidth={active ? 2.2 : 1.7} />
                    )}
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
      <BetaNotice />
    </div>
  );
}

const rootApi = getRouteApi("__root__");

function AuthChip() {
  const { sessionUser } = rootApi.useRouteContext();
  const { user, isPending } = useCurrentUserState();
  const signedIn = isPending ? Boolean(sessionUser) : Boolean(user);
  if (signedIn) {
    return (
      <Link to="/you" className="inline-flex h-9 items-center rounded-full bg-bg-warm px-3.5 text-sm font-medium text-fg">
        You
      </Link>
    );
  }
  return (
    <Link
      to="/login"
      className="inline-flex h-9 items-center rounded-full bg-primary px-3.5 text-sm font-medium text-primary-fg"
    >
      Sign in or create account
    </Link>
  );
}

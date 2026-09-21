import { getRouteApi, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const rootApi = getRouteApi("__root__");

/**
 * Guests must see a real page in the first HTML response. Session `isPending`
 * is true during SSR, so waiting on it paints a blank "Loading…" shell.
 * Trust the server session: no session means signed out.
 */
export function useAuthGate() {
  const { sessionUser } = rootApi.useRouteContext();
  const state = useCurrentUserState();
  const showGuest = !state.user && (!state.isPending || !sessionUser);
  const showLoading = !state.user && state.isPending && Boolean(sessionUser);
  return { ...state, showGuest, showLoading };
}

export function GuestGate({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-lg py-6">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">{title}</h1>
      <p className="mt-2 text-pretty text-muted">{body}</p>
      {children}
      <div className="mt-6 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
        <p className="font-medium">Sign in or create account</p>
        <p className="mt-1 text-sm text-muted">
          Browse stays free. Sign in to list, offer, or pay. You deal as a handle. Meet at a partner store — never a
          home address.
        </p>
        <Button asChild className="mt-4 w-full">
          <Link to="/login">Sign in or create account</Link>
        </Button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button asChild variant="secondary">
            <Link to="/">Browse</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/sales">This weekend</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

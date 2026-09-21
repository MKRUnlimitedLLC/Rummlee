import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

/** Shown instead of an empty outlet while a loader is pending. */
function RoutePending() {
  return (
    <main className="bg-bg py-16 text-center text-fg">
      <p className="font-display text-2xl font-semibold tracking-[-0.03em]">The good stuff, before Saturday.</p>
      <p className="mt-2 text-sm text-muted">Loading this weekend’s listings…</p>
    </main>
  );
}

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultPendingComponent: RoutePending,
    // SSR markup stays up. A 0 stale time reloads immediately; if that reload
    // is still pending and no pending component is set, the outlet renders null.
    defaultStaleTime: 30_000,
  });
}

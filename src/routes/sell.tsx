import { createFileRoute, redirect } from "@tanstack/react-router";

/** Bare /sell deep links land on the guest draft, same as the Sell tab. */
export const Route = createFileRoute("/sell")({
  beforeLoad: () => {
    throw redirect({ to: "/listings/new", statusCode: 307 });
  },
});

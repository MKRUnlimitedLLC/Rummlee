import { createFileRoute, redirect } from "@tanstack/react-router";

/** Bookmarks and a “Browse” path land on the home listings, not a 404. */
export const Route = createFileRoute("/browse")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});

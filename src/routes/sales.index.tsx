import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Store } from "lucide-react";
import { bootstrapPublic } from "@/lib/rummlee/server";
import { saleWindow } from "@/lib/rummlee/format";
import { SALE_KINDS } from "@/lib/rummlee/constants";
import type { HandoffSpot } from "@/lib/rummlee/types";

export const Route = createFileRoute("/sales/")({
  loader: () => bootstrapPublic(),
  component: SalesPage,
});

function SalesPage() {
  const initial = Route.useLoaderData();
  const { data } = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => bootstrapPublic(),
    initialData: initial,
  });
  const partners = data.spots.filter((s) => s.kind === "partner");
  const publicSpots = data.spots.filter((s) => s.kind === "public");

  return (
    <main className="py-6">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">This weekend</h1>
      <p className="mt-1 text-muted">
        Neighborhood sales from Brooklyn to Scottsdale. Offer now — meet at a handoff location, never a home address.
      </p>

      <ul className="mt-6 space-y-3">
        {data.sales.map((s) => {
          const kind = SALE_KINDS.find((k) => k.id === s.kind)?.label ?? "Sale";
          const spot = data.spots.find((sp) => sp.id === s.handoffSpotId);
          return (
            <li key={s.id}>
              <Link
                to="/sales/$id"
                params={{ id: s.id }}
                className="flex items-start justify-between gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)] transition-transform duration-150 active:scale-[0.99]"
              >
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-primary-ink">{kind}</p>
                  <h2 className="font-display text-xl font-medium tracking-[-0.02em]">{s.name}</h2>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                    <MapPin className="size-3.5" />
                    {s.neighborhood} · @{s.sellerHandle}
                  </p>
                  <p className="mt-1 text-sm text-subtle">
                    {spot ? `${spot.name} · ` : ""}
                    {saleWindow(s.startsOn, s.endsOn)} · {s.itemCount} {s.itemCount === 1 ? "item" : "items"}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-10 font-display text-xl font-semibold tracking-[-0.03em]">Official store handoff</h2>
      <p className="mt-1 text-sm text-muted">A Rummlee partner store. Locker or pickup desk. Store hours, lit lot. Your address stays off the listing.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {partners.map((sp) => (
          <SpotCard key={sp.id} spot={sp} featured />
        ))}
      </ul>

      <h2 className="mt-10 font-display text-xl font-semibold tracking-[-0.03em]">Public place handoff</h2>
      <p className="mt-1 text-sm text-muted">Park, library, or civic lot — if the seller offers it.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {publicSpots.map((sp) => (
          <SpotCard key={sp.id} spot={sp} />
        ))}
      </ul>

      <h2 className="mt-10 font-display text-xl font-semibold tracking-[-0.03em]">In person handoff</h2>
      <p className="mt-1 text-sm text-muted">
        No pinned map. If a seller offers it, you still meet as handles. A home address never goes on the listing.
      </p>
    </main>
  );
}

function SpotCard({ spot, featured }: { spot: HandoffSpot; featured?: boolean }) {
  return (
    <li className={featured ? "rounded-2xl bg-primary-soft p-4" : "rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]"}>
      {featured ? (
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-primary-ink">
          <Store className="size-3.5" />
          Official store handoff
        </p>
      ) : (
        <p className="text-xs font-medium uppercase tracking-wider text-subtle">Public place handoff</p>
      )}
      <p className="mt-1 font-medium">{spot.name}</p>
      <p className="text-sm text-muted">{spot.area}</p>
      <p className="mt-1 text-sm text-subtle">{spot.hint}</p>
    </li>
  );
}

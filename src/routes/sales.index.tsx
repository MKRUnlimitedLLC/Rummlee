import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Store } from "lucide-react";
import { bootstrapPublic } from "@/lib/rummlee/server";
import { liveWindowLine, onlineWindowLine, saleWhen } from "@/lib/rummlee/format";
import { SALE_KINDS } from "@/lib/rummlee/constants";
import type { HandoffSpot } from "@/lib/rummlee/types";
import { isSamplePartnerSpot, publicSpotHint, sampleStoreEyebrow } from "@/lib/rummlee/sample-store";
import { publicHead } from "@/lib/rummlee/seo";

export const Route = createFileRoute("/sales/")({
  head: () => publicHead("/sales", "Sample neighborhood sales", "Samples only. No store is taking a package. Nothing ships."),
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
  const signedPartners = partners.filter((s) => !isSamplePartnerSpot(s.id));
  const samplePartners = partners.filter((s) => isSamplePartnerSpot(s.id));
  const publicSpots = data.spots.filter((s) => s.kind === "public");

  return (
    <main className="py-6">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">Sample sales</h1>
      <p className="mt-1 text-muted">
        These are samples. No store is taking a package, and nothing is for sale today. Nothing ships.{" "}
        <Link to="/" className="font-medium text-primary-ink">
          Be first to know
        </Link>
        {" · "}
        <Link to="/handoff" className="font-medium text-primary-ink">
          Apply as an official store
        </Link>
        {" · "}
        <Link to="/sales/how" className="font-medium text-primary-ink">
          How to run one in person
        </Link>
      </p>

      <ul className="mt-6 space-y-3">
        {data.sales.map((s) => {
          const kind = s.kind === "house" ? "Rummlee shelf" : (SALE_KINDS.find((k) => k.id === s.kind)?.label ?? "Sale");
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
                    {saleWhen(s.startsOn, s.endsOn, s.alwaysOn)}
                    {onlineWindowLine(s) ? ` · ${onlineWindowLine(s)}` : " · online"}
                    {liveWindowLine(s) ? ` · ${liveWindowLine(s)}` : ""}
                    {" · "}
                    {s.itemCount} {s.itemCount === 1 ? "item" : "items"}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {signedPartners.length > 0 ? (
        <>
          <h2 className="mt-10 font-display text-xl font-semibold tracking-[-0.03em]">Official store handoff</h2>
          <p className="mt-1 text-sm text-muted">An official store handoff. Locker or pickup desk. Store hours, lit lot. Your address stays off the listing.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {signedPartners.map((sp) => (
              <SpotCard key={sp.id} spot={sp} featured />
            ))}
          </ul>
        </>
      ) : null}

      {samplePartners.length > 0 ? (
        <>
          <h2 className="mt-10 font-display text-xl font-semibold tracking-[-0.03em]">Sample stores</h2>
          <p className="mt-1 text-sm text-muted">These names are samples. No store has signed. A shop is not holding a package.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {samplePartners.map((sp) => (
              <SpotCard key={sp.id} spot={sp} sample />
            ))}
          </ul>
        </>
      ) : null}

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

function SpotCard({ spot, featured, sample }: { spot: HandoffSpot; featured?: boolean; sample?: boolean }) {
  return (
    <li className={featured || sample ? "rounded-2xl bg-primary-soft p-4" : "rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]"}>
      {featured || sample ? (
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-primary-ink">
          <Store className="size-3.5" />
          {sample ? sampleStoreEyebrow(spot.id) : "Official store handoff"}
        </p>
      ) : (
        <p className="text-xs font-medium uppercase tracking-wider text-subtle">Public place handoff</p>
      )}
      <p className="mt-1 font-medium">{spot.name}</p>
      <p className="text-sm text-muted">{spot.area}</p>
      {sample ? <p className="mt-1 text-sm font-medium text-fg">Not a signed store.</p> : null}
      <p className="mt-1 text-sm text-subtle">{publicSpotHint(spot.id, spot.hint)}</p>
    </li>
  );
}

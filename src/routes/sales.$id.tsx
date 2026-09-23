import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { bootstrapPublic, getSale } from "@/lib/rummlee/server";
import { liveWindowLine, onlineWindowLine, saleWindow } from "@/lib/rummlee/format";
import { SALE_KINDS } from "@/lib/rummlee/constants";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/sales/$id")({
  loader: async ({ params }) => {
    const [sale, boot] = await Promise.all([getSale({ data: params.id }), bootstrapPublic()]);
    return { sale, spots: boot.spots, buyerPremium: boot.buyerPremium };
  },
  component: SaleDetail,
});

function SaleDetail() {
  const { id } = Route.useParams();
  const initial = Route.useLoaderData();
  const { data } = useQuery({
    queryKey: ["sale", id],
    queryFn: () => getSale({ data: id }),
    initialData: initial.sale,
  });

  if (!data) {
    return (
      <main className="py-16 text-center text-muted">
        Sale not found.{" "}
        <Link to="/sales" className="text-primary-ink">
          All sales
        </Link>
      </main>
    );
  }

  const kind = SALE_KINDS.find((k) => k.id === data.sale.kind)?.label ?? "Sale";
  const spot = initial.spots.find((sp) => sp.id === data.sale.handoffSpotId);
  const { user } = useCurrentUserState();
  const mine = Boolean(user?.id && user.id === data.sale.sellerId);

  return (
    <main className="py-6">
      <p className="text-xs font-medium uppercase tracking-wider text-primary-ink">{kind}</p>
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">{data.sale.name}</h1>
      <p className="mt-2 flex items-center gap-1 text-muted">
        <MapPin className="size-4" />
        {spot?.name ?? data.sale.neighborhood} · @{data.sale.sellerHandle}
      </p>
      <p className="mt-1 text-sm text-subtle">{saleWindow(data.sale.startsOn, data.sale.endsOn)}</p>
      {onlineWindowLine(data.sale) ? (
        <p className="mt-2 text-sm font-medium text-fg">{onlineWindowLine(data.sale)}</p>
      ) : (
        <p className="mt-2 text-sm text-muted">Online on Rummlee. Nothing ships.</p>
      )}
      {liveWindowLine(data.sale) ? (
        <p className="mt-1 text-sm text-fg">{liveWindowLine(data.sale)} · In person · hours only. No home address.</p>
      ) : (
        <p className="mt-1 text-sm text-muted">Online only for this run.</p>
      )}
      {mine && data.meetupNote ? (
        <p className="mt-2 text-sm text-muted">Your meetup note is hidden until someone pays for in-person handoff.</p>
      ) : null}
      {mine ? (
        <Button asChild className="mt-4">
          <Link to="/listings/new">Add another item to this sale</Link>
        </Button>
      ) : null}
      {spot ? (
        <div className="mt-4 rounded-2xl bg-primary-soft px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-primary-ink">
            {spot.kind === "partner" ? "Official store handoff" : "Public place handoff"}
          </p>
          <p className="mt-1 font-medium">{spot.name}</p>
          <p className="text-sm text-muted">{spot.hint}</p>
        </div>
      ) : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {data.listings.map((l) => (
          <ListingCard key={l.id} listing={l} premium={initial.buyerPremium} />
        ))}
      </div>
    </main>
  );
}

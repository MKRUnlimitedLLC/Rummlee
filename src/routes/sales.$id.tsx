import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { bootstrapPublic, getSale } from "@/lib/rummlee/server";
import { saleWindow } from "@/lib/rummlee/format";
import { SALE_KINDS } from "@/lib/rummlee/constants";

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

  return (
    <main className="py-6">
      <p className="text-xs font-medium uppercase tracking-wider text-primary-ink">{kind}</p>
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">{data.sale.name}</h1>
      <p className="mt-2 flex items-center gap-1 text-muted">
        <MapPin className="size-4" />
        {spot?.name ?? data.sale.neighborhood} · @{data.sale.sellerHandle}
      </p>
      <p className="mt-1 text-sm text-subtle">{saleWindow(data.sale.startsOn, data.sale.endsOn)}</p>
      {spot ? (
        <div className="mt-4 rounded-2xl bg-primary-soft px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-primary-ink">
            {spot.kind === "partner" ? "Partner store" : "Public place"}
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

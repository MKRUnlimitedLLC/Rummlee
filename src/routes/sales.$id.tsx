import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ListingCard } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bootstrapPublic, extendSale, featureSale, getSale, setOvertime, stashListing, removeListing } from "@/lib/rummlee/server";
import { liveWindowLine, money, onlineWindowLine, saleHasEnded, saleWhen } from "@/lib/rummlee/format";
import { MAX_SALE_DAYS, SALE_KINDS } from "@/lib/rummlee/constants";
import { DEFAULT_FEES, feeById, formatFeeValue } from "@/lib/rummlee/fees";
import { errMessage } from "@/lib/rummlee/errors";
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

  const kind = data.sale.kind === "house" ? "Rummlee shelf" : (SALE_KINDS.find((k) => k.id === data.sale.kind)?.label ?? "Sale");
  const spot = initial.spots.find((sp) => sp.id === data.sale.handoffSpotId);
  const { user } = useCurrentUserState();
  const mine = Boolean(user?.id && user.id === data.sale.sellerId);
  const closing = !data.sale.alwaysOn && data.sale.endsOn.slice(0, 10) <= tomorrowIso();
  const dayFee = formatFeeValue(feeById(DEFAULT_FEES, "sale_day") ?? DEFAULT_FEES[0]);
  const featureFee = formatFeeValue(feeById(DEFAULT_FEES, "feature_sale") ?? DEFAULT_FEES[0]);

  return (
    <main className="py-6">
      <p className="text-xs font-medium uppercase tracking-wider text-primary-ink">{kind}</p>
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">{data.sale.name}</h1>
      <p className="mt-2 flex items-center gap-1 text-muted">
        <MapPin className="size-4" />
        {spot?.name ?? data.sale.neighborhood} · @{data.sale.sellerHandle}
      </p>
      <p className="mt-1 text-sm text-subtle">{saleWhen(data.sale.startsOn, data.sale.endsOn, data.sale.alwaysOn)}</p>
      {data.sale.featured ? <p className="mt-1 text-sm font-medium text-primary-ink">Featured</p> : null}
      {data.sale.alwaysOn ? (
        <p className="mt-2 text-sm text-fg">
          Always on at the Fargo official store. These are items someone left. Half of what Rummlee receives is set
          aside for charity. Rummlee never ships.
        </p>
      ) : onlineWindowLine(data.sale) ? (
        <p className="mt-2 text-sm font-medium text-fg">{onlineWindowLine(data.sale)}</p>
      ) : (
        <p className="mt-2 text-sm text-muted">Online on Rummlee. Rummlee never ships.</p>
      )}
      {data.sale.alwaysOn ? null : liveWindowLine(data.sale) ? (
        <p className="mt-1 text-sm text-fg">{liveWindowLine(data.sale)} · Private handoff during these hours. The address shows after you pay.</p>
      ) : (
        <p className="mt-1 text-sm text-muted">Online only for this run.</p>
      )}
      {mine && data.meetupNote ? (
        <p className="mt-2 text-sm text-muted">Your meetup note is hidden until someone pays for in-person handoff.</p>
      ) : null}
      {mine && closing ? <ExtendAsk saleId={data.sale.id} dayFee={dayFee} featureFee={featureFee} featured={Boolean(data.sale.featured)} /> : null}
      {mine && !closing && !data.sale.alwaysOn ? (
        <FeatureAsk saleId={data.sale.id} featureFee={featureFee} featured={Boolean(data.sale.featured)} />
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
      {mine && saleHasEnded(data.sale.endsOn, data.sale.alwaysOn) ? (
        <OvertimeList saleId={data.sale.id} listings={data.listings.filter((l) => l.status === "live" && !l.charitySplit)} />
      ) : null}
    </main>
  );
}

function OvertimeList({
  saleId,
  listings,
}: {
  saleId: string;
  listings: { id: string; title: string; priceCents: number; overtimeCents?: number | null }[];
}) {
  if (!listings.length) return null;
  return (
    <section className="mt-6 space-y-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
      <p className="font-medium">Overtime for +++</p>
      <p className="text-sm text-muted">
        Unsold items only. Set a get-rid-of-it price and +++ members get one more offer under it, or they can pay that price. It is not shown to anyone else.
      </p>
      {listings.map((item) => (
        <OvertimeRow key={item.id} saleId={saleId} item={item} />
      ))}
    </section>
  );
}

function OvertimeRow({
  saleId,
  item,
}: {
  saleId: string;
  item: { id: string; title: string; priceCents: number; overtimeCents?: number | null };
}) {
  const qc = useQueryClient();
  const [dollars, setDollars] = useState(item.overtimeCents == null ? "" : String(item.overtimeCents / 100));
  const save = useMutation({
    mutationFn: (cents: number | null) => setOvertime({ data: { listingId: item.id, cents } }),
    onSuccess: () => {
      toast.success("Saved.");
      void qc.invalidateQueries({ queryKey: ["sale", saleId] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const stash = useMutation({
    mutationFn: () => stashListing({ data: { listingId: item.id } }),
    onSuccess: () => {
      toast.success("Stashed for a later sale.");
      void qc.invalidateQueries({ queryKey: ["sale", saleId] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => removeListing({ data: { listingId: item.id } }),
    onSuccess: () => {
      toast.success("Removed.");
      void qc.invalidateQueries({ queryKey: ["sale", saleId] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  return (
    <form
      className="flex flex-wrap items-end gap-2 border-t border-border pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(Math.round(Number(dollars) * 100));
      }}
    >
      <div className="min-w-40 flex-1">
        <p className="text-sm font-medium">{item.title}</p>
        <p className="text-sm text-muted">Asking was {money(item.priceCents)}</p>
      </div>
      <Input className="w-28" inputMode="decimal" value={dollars} onChange={(e) => setDollars(e.target.value)} placeholder="25" />
      <Button type="submit" size="sm" disabled={save.isPending}>
        {item.overtimeCents ? "Update" : "Open"}
      </Button>
      {item.overtimeCents ? (
        <Button type="button" size="sm" variant="secondary" disabled={save.isPending} onClick={() => save.mutate(null)}>
          Off
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="secondary" disabled={stash.isPending} onClick={() => stash.mutate()}>
        Stash
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate()}>
        Remove
      </Button>
    </form>
  );
}

function tomorrowIso() {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

function ExtendAsk({
  saleId,
  dayFee,
  featureFee,
  featured,
}: {
  saleId: string;
  dayFee: string;
  featureFee: string;
  featured: boolean;
}) {
  const qc = useQueryClient();
  const [feature, setFeature] = useState(false);
  const extend = useMutation({
    mutationFn: (extraDays: number) => extendSale({ data: { saleId, extraDays, feature } }),
    onSuccess: (res) => {
      toast.success(
        `Extended through ${res.endsOn}. ${res.chargeCents > 0 ? `Paid with ${res.paidNote}.` : "No charge. Plus or +++ covered the days."}`,
      );
      void qc.invalidateQueries({ queryKey: ["sale", saleId] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  return (
    <section className="mt-4 space-y-3 rounded-2xl bg-primary-soft px-4 py-3">
      <p className="font-medium">This sale is about to close</p>
      <p className="text-sm text-muted">
        Keep it up, or it leaves browse after the last day. {dayFee} a day. Plus free days apply. +++ days are free. A sale can run {MAX_SALE_DAYS} days.
        If test credits don’t cover it, the rest comes out of your next payout.
      </p>
      {featured ? null : (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={feature} onChange={(e) => setFeature(e.target.checked)} />
          Also feature the sale · {featureFee}
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {[1, 3, 7].map((days) => (
          <Button key={days} size="sm" disabled={extend.isPending} onClick={() => extend.mutate(days)}>
            {extend.isPending ? "Saving…" : `Add ${days} day${days === 1 ? "" : "s"}`}
          </Button>
        ))}
      </div>
    </section>
  );
}

function FeatureAsk({ saleId, featureFee, featured }: { saleId: string; featureFee: string; featured: boolean }) {
  const qc = useQueryClient();
  const feature = useMutation({
    mutationFn: () => featureSale({ data: { saleId } }),
    onSuccess: (res) => {
      toast.success(res.chargeCents > 0 ? `Featured. Paid with ${res.paidNote}.` : "Featured.");
      void qc.invalidateQueries({ queryKey: ["sale", saleId] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  if (featured) return <p className="mt-3 text-sm font-medium text-primary-ink">Featured until this sale ends.</p>;
  return (
    <div className="mt-4">
      <Button size="sm" variant="secondary" disabled={feature.isPending} onClick={() => feature.mutate()}>
        {feature.isPending ? "Featuring…" : `Feature this sale · ${featureFee}`}
      </Button>
      <p className="mt-1 text-sm text-muted">Your items show first. Taken from test credits, then from the next payout.</p>
    </div>
  );
}

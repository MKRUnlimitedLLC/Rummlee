import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createBuyerBundle, createSellerBundle, getBundleSheet } from "@/lib/rummlee/bundles";
import { errMessage } from "@/lib/rummlee/errors";
import { money } from "@/lib/rummlee/format";
import { buyNow } from "@/lib/rummlee/server";

export const Route = createFileRoute("/bundle")({
  validateSearch: (search: Record<string, unknown>) => ({
    seller: typeof search.seller === "string" ? search.seller : "",
    from: typeof search.from === "string" ? search.from : "",
  }),
  loaderDeps: ({ search }) => ({ seller: search.seller }),
  loader: ({ deps }) => (deps.seller ? getBundleSheet({ data: deps.seller }) : null),
  component: BundlePage,
});

function cents(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function BundlePage() {
  const data = Route.useLoaderData();
  const { from } = Route.useSearch();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<string[]>(from ? [from] : []);
  const [title, setTitle] = useState("");
  const [asking, setAsking] = useState("");
  const [floor, setFloor] = useState("");
  const [offer, setOffer] = useState("");

  const sellerBundle = useMutation({
    mutationFn: () =>
      createSellerBundle({
        data: { listingIds: picked, title: title.trim(), priceCents: cents(asking), floorCents: cents(floor || asking) },
      }),
    onSuccess: (res) => {
      toast.success("Bundle is up. The items are no longer listed on their own.");
      void navigate({ to: "/listings/$id", params: { id: res.id } });
    },
    onError: (error) => toast.error(errMessage(error)),
  });

  const buyerOffer = useMutation({
    mutationFn: () => createBuyerBundle({ data: { listingIds: picked, amountCents: cents(offer) } }),
    onSuccess: (res) => {
      if (res.status === "declined") {
        toast.error("Under the lowest. No deal. You can still pay asking on each item.");
        return;
      }
      toast.success("Offer sent on the bundle. One counter, then it’s done.");
      void navigate({ to: "/listings/$id", params: { id: res.id } });
    },
    onError: (error) => toast.error(errMessage(error)),
  });

  const pay = useMutation({
    mutationFn: async () => {
      const created = await createBuyerBundle({ data: { listingIds: picked } });
      try {
        const order = await buyNow({
          data: { listingId: created.id, amountCents: created.asking, payAsking: true, handoffType: "official", meet: "partner" },
        });
        return { kind: "paid" as const, orderId: order.orderId, id: created.id };
      } catch (error) {
        return { kind: "open" as const, id: created.id, message: errMessage(error) };
      }
    },
    onSuccess: (res) => {
      if (res.kind === "open") {
        toast.error(res.message);
        void navigate({ to: "/listings/$id", params: { id: res.id } });
        return;
      }
      toast.success("Held. One handoff for the whole bundle.");
      void navigate({ to: "/pickup/$id", params: { id: res.orderId } });
    },
    onError: (error) => toast.error(errMessage(error)),
  });

  if (!data) {
    return (
      <main className="py-16 text-center">
        <p className="text-muted">Open a listing, then start a bundle from there.</p>
      </main>
    );
  }

  const items = data.items.filter((item) => !from || item.neighborhood === data.items.find((row) => row.id === from)?.neighborhood || item.id === from);
  const selected = items.filter((item) => picked.includes(item.id));
  const total = selected.reduce((sum, item) => sum + item.priceCents, 0);

  function toggle(id: string) {
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <main className="mx-auto max-w-lg space-y-4 py-6">
      <h1 className="font-display text-2xl font-semibold">Bundle</h1>
      <p className="text-sm text-muted">
        {data.mine
          ? "Pick your items. Set one asking price and one hidden lowest price. They leave the browse page until you take the bundle down."
          : `Pick live items from @${data.sellerHandle}. One offer on the total. One decline ends it. The lowest prices stay hidden.`}
      </p>
      {data.mine ? <SellerExample /> : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-[var(--shadow-card)]">
              <input
                type="checkbox"
                checked={picked.includes(item.id)}
                disabled={!data.mine && item.offerUsed}
                onChange={() => toggle(item.id)}
              />
              <img src={item.photoUrl} alt="" className="size-14 rounded-lg object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.title}</span>
                <span className="text-sm text-muted">{money(item.priceCents)}</span>
                {!data.mine && item.offerUsed ? (
                  <span className="block text-sm text-muted">Offer already used. Pay asking on this one.</span>
                ) : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-sm text-fg">
        {selected.length} selected · items add up to {money(total)}
      </p>
      {data.mine ? (
        <div className="space-y-3">
          <div>
            <Label htmlFor="bundle-title">Bundle name</Label>
            <Input id="bundle-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Lamp and chair" />
          </div>
          <div>
            <Label htmlFor="bundle-ask">Asking price</Label>
            <Input id="bundle-ask" inputMode="decimal" value={asking} onChange={(event) => setAsking(event.target.value)} placeholder="120" />
          </div>
          <div>
            <Label htmlFor="bundle-floor">Lowest you’ll take</Label>
            <Input id="bundle-floor" inputMode="decimal" value={floor} onChange={(event) => setFloor(event.target.value)} placeholder="Same as asking if you skip this" />
            <p className="mt-1 text-sm text-muted">Hidden. Can be lower than the items added together.</p>
          </div>
          <Button className="w-full" disabled={picked.length < 2 || sellerBundle.isPending} onClick={() => sellerBundle.mutate()}>
            {sellerBundle.isPending ? "Publishing…" : "Publish bundle"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="bundle-offer">Your offer on the total</Label>
            <Input id="bundle-offer" inputMode="decimal" value={offer} onChange={(event) => setOffer(event.target.value)} placeholder="Under the total" />
          </div>
          <Button className="w-full" disabled={picked.length < 2 || buyerOffer.isPending} onClick={() => buyerOffer.mutate()}>
            {buyerOffer.isPending ? "Sending…" : "Send one offer"}
          </Button>
          <Button className="w-full" variant="secondary" disabled={picked.length < 2 || pay.isPending} onClick={() => pay.mutate()}>
            {pay.isPending ? "Holding…" : `Pay ${money(total)} asking`}
          </Button>
          <p className="text-sm text-muted">
            Pay asking uses the official store when every item is boxed and the weights add up to 50 lb or less. Otherwise the bundle is in person only.
          </p>
        </div>
      )}
      <Link to="/browse" className="inline-block text-sm font-medium text-primary-ink">
        Back to browse
      </Link>
    </main>
  );
}

function SellerExample() {
  return (
    <section className="space-y-3 rounded-2xl bg-primary-soft px-4 py-4 text-sm text-fg">
      <h2 className="font-display text-lg font-semibold">Example</h2>
      <p>A lamp is listed at $40. A chair is listed at $100. Together that is $140. You can ask less for the pair.</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>List each item on its own first, with a photo, an asking price, and a lowest price.</li>
        <li>Open either listing and tap Bundle items from this sale.</li>
        <li>Check the lamp and the chair. You need at least two, from the same neighborhood.</li>
        <li>Name it Lamp and chair.</li>
        <li>Asking price: 120. Lowest you’ll take: 100. Buyers never see 100.</li>
        <li>Tap Publish bundle. The lamp and the chair leave browse. One listing stays up.</li>
      </ol>
      <p>
        A buyer can pay $120, or offer under it. You get one counteroffer. One decline ends the deal. The store fee is
        charged once, if both pieces are in an outer box and weigh 50 lb or less together.
      </p>
      <p>If nobody has paid, open the bundle and tap Put the items back on their own.</p>
    </section>
  );
}

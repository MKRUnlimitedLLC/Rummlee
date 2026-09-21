import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, MapPin, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PriceTag } from "@/components/price-tag";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { errMessage, isUnauthorized } from "@/lib/rummlee/errors";
import { FeeLine } from "@/components/fee-line";
import { categoryLabel, haulLabel, money, payBaseCents, payQuote, saleWindow } from "@/lib/rummlee/format";
import { buyNow, getListing, sendMessage, sendOffer, toggleSaved } from "@/lib/rummlee/server";

export const Route = createFileRoute("/listings/$id")({
  loader: ({ params }) => getListing({ data: params.id }),
  component: ListingPage,
});

function ListingPage() {
  const { id } = Route.useParams();
  const initial = Route.useLoaderData();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useCurrentUserState();
  const { data } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => getListing({ data: id }),
    initialData: initial,
  });
  const [offer, setOffer] = useState("");
  const [note, setNote] = useState("");
  const [ask, setAsk] = useState("");
  const [meet, setMeet] = useState<"partner" | "public" | "person">("partner");

  if (!data?.listing) {
    return (
      <main className="py-16 text-center">
        <p className="text-muted">That listing isn’t here anymore.</p>
        <Link to="/" className="mt-3 inline-block text-sm font-medium text-primary-ink">
          Back to browse
        </Link>
      </main>
    );
  }

  const listing = data.listing;
  const asking = listing.priceCents;
  const base = payBaseCents(asking, data.myOffer);
  const premium = Boolean(data.buyerPremium);
  const quote = payQuote(base, premium);
  const personOk = listing.handoffModes.includes("porch");
  const publicSpot = data.publicSpot;
  const mine = user?.id === listing.sellerId;

  const saveMut = useMutation({
    mutationFn: () => toggleSaved({ data: listing.id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["listing", id] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: (e) => {
      if (isUnauthorized(e)) void navigate({ to: "/login" });
      else toast.error(errMessage(e));
    },
  });

  const offerMut = useMutation({
    mutationFn: () =>
      sendOffer({
        data: {
          listingId: listing.id,
          amountCents: Math.round(Number(offer) * 100),
          note: note || undefined,
        },
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["listing", id] });
      if (res.status === "accepted") toast.success("Offer accepted — pay from your wallet to lock it in.");
      else if (res.status === "countered") toast.success("They countered. Check the new price.");
      else toast.success("Offer sent. The seller can accept, counter, or decline.");
      setOffer("");
    },
    onError: (e) => {
      if (isUnauthorized(e)) void navigate({ to: "/login" });
      else toast.error(errMessage(e));
    },
  });

  const buyMut = useMutation({
    mutationFn: () =>
      buyNow({
        data: {
          listingId: listing.id,
          amountCents: base,
          handoffType: meet === "person" ? "porch" : "official",
          meet,
          handoffSpotId: meet === "public" ? publicSpot?.id ?? null : null,
        },
      }),
    onSuccess: (res) => {
      toast.success("Paid. Pickup is held in escrow until you both scan.");
      void navigate({ to: "/pickup/$id", params: { id: res.orderId } });
    },
    onError: (e) => {
      if (isUnauthorized(e)) void navigate({ to: "/login" });
      else toast.error(errMessage(e));
    },
  });

  const msgMut = useMutation({
    mutationFn: () => sendMessage({ data: { listingId: listing.id, body: ask } }),
    onSuccess: () => {
      setAsk("");
      void qc.invalidateQueries({ queryKey: ["listing", id] });
    },
    onError: (e) => {
      if (isUnauthorized(e)) void navigate({ to: "/login" });
      else toast.error(errMessage(e));
    },
  });

  const meetChoices = [
    {
      id: "partner" as const,
      label: "Partner store",
      hint: listing.handoffSpotName ?? "Locker or pickup desk, store hours.",
      enabled: true,
    },
    {
      id: "public" as const,
      label: "Public place",
      hint: publicSpot ? publicSpot.name : "No public place in this neighborhood yet.",
      enabled: Boolean(publicSpot),
    },
    {
      id: "person" as const,
      label: "Person to person",
      hint: personOk ? "Optional. Still no home address." : "Not offered on this item.",
      enabled: personOk,
    },
  ];

  return (
    <article className="py-5">
      <div className="overflow-hidden rounded-[24px] bg-surface shadow-[var(--shadow-card)]">
        <div className="relative aspect-[4/5] bg-bg-warm sm:aspect-[4/3]">
          <img src={listing.photoUrl} alt="" className="size-full object-cover" />
          <span className="absolute left-3 top-3 rounded-md bg-surface/92 px-2 py-1 text-xs font-medium backdrop-blur-sm">
            {saleWindow(listing.saleStartsOn, listing.saleEndsOn)}
          </span>
          <button
            type="button"
            aria-label={listing.saved ? "Unsave" : "Save"}
            className="absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-surface/92 text-fg shadow-[var(--shadow-card)] backdrop-blur-sm"
            onClick={() => saveMut.mutate()}
          >
            {listing.saved ? <BookmarkCheck className="size-5" /> : <Bookmark className="size-5" />}
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{listing.title}</h1>
            <PriceTag cents={listing.priceCents} original={listing.originalCents} size="lg" />
            <FeeLine baseCents={base} premium={premium} agreed={base !== asking} />
            <p className="flex items-center gap-1 text-sm text-muted">
              <MapPin className="size-3.5" />
              {listing.handoffSpotName ?? listing.neighborhood} · @{listing.sellerHandle}
            </p>
          </div>
          <p className="text-pretty text-sm leading-relaxed text-fg">{listing.description}</p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Meta label="Condition" value={listing.condition} />
            <Meta label="Category" value={categoryLabel(listing.category)} />
            <Meta label="Haul" value={haulLabel(listing.haul)} />
            <Meta label="Sale" value={listing.saleName} />
          </dl>
          <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary-ink">
              Partner store
            </span>
          <Link to="/sales/$id" params={{ id: listing.saleId }} className="block text-sm font-medium text-primary-ink">
            See the rest of this sale
          </Link>
          <p className="text-xs text-subtle">
            Neighbors see @{listing.sellerHandle} — never a real name or home address.
            {listing.handoffSpotKind === "partner" ? " Partner store handoff." : ""}
          </p>
        </div>
      </div>

      {listing.status !== "live" ? (
        <p className="mt-5 rounded-2xl bg-surface px-4 py-6 text-center text-muted shadow-[var(--shadow-card)]">
          This one already sold.
        </p>
      ) : mine ? (
        <p className="mt-5 rounded-2xl bg-surface px-4 py-6 text-center text-muted shadow-[var(--shadow-card)]">
          This is your listing. Offers show up in Inbox.
        </p>
      ) : (
        <section className="mt-5 space-y-4 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-xl font-semibold">Take it home</h2>
          <p className="text-sm text-muted">
            You deal as a handle. Pay is held until you both scan. Partner store is the default.
          </p>
          <div className="space-y-2">
            {meetChoices.map((choice, index) => {
              const selected = meet === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  disabled={!choice.enabled}
                  onClick={() => setMeet(choice.id)}
                  className={
                    selected
                      ? "flex w-full flex-col items-start rounded-2xl bg-fg px-4 py-3 text-left text-primary-fg"
                      : "flex w-full flex-col items-start rounded-2xl bg-bg px-4 py-3 text-left disabled:opacity-50"
                  }
                >
                  <span className="text-sm font-medium">
                    {index + 1}. {choice.label}
                    {choice.id === "partner" ? <span className="ml-2 text-xs font-medium opacity-80">Default</span> : null}
                  </span>
                  <span className={selected ? "mt-0.5 text-xs text-primary-fg/80" : "mt-0.5 text-xs text-muted"}>
                    {choice.hint}
                  </span>
                </button>
              );
            })}
          </div>
          {meet === "partner" && listing.handoffSpotName ? (
            <div className="rounded-xl bg-bg px-3.5 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-primary-ink">Partner store</p>
              <p className="mt-1 font-medium">{listing.handoffSpotName}</p>
              <p className="text-sm text-muted">{listing.handoffSpotArea}</p>
              {listing.handoffSpotHint ? <p className="mt-1 text-sm text-subtle">{listing.handoffSpotHint}</p> : null}
            </div>
          ) : null}
          {meet === "public" && publicSpot ? (
            <div className="rounded-xl bg-bg px-3.5 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-subtle">Public place</p>
              <p className="mt-1 font-medium">{publicSpot.name}</p>
              <p className="text-sm text-muted">{publicSpot.area}</p>
              <p className="mt-1 text-sm text-subtle">{publicSpot.hint}</p>
            </div>
          ) : null}
          {meet === "person" ? (
            <p className="rounded-xl bg-bg px-3.5 py-3 text-sm text-muted">
              Optional. You still meet as handles. No home address is posted.
            </p>
          ) : null}
          {data.myOffer ? (
            <p className="rounded-xl bg-primary-soft px-3 py-2 text-sm text-primary-ink">
              Your offer: {money(data.myOffer.amountCents)} · {data.myOffer.status}
              {data.myOffer.counterCents ? ` · counter ${money(data.myOffer.counterCents)}` : ""}
            </p>
          ) : null}
          {data.myOffer?.status === "accepted" || data.myOffer?.status === "countered" ? (
            <Button className="w-full" disabled={buyMut.isPending} onClick={() => buyMut.mutate()}>
              {buyMut.isPending ? "Paying…" : `Pay ${money(quote.youPayCents)}`}
            </Button>
          ) : (
            <Button className="w-full" disabled={buyMut.isPending} onClick={() => (user ? buyMut.mutate() : navigate({ to: "/login" }))}>
              Buy now · {money(quote.youPayCents)}
            </Button>
          )}

          {!data.myOffer || data.myOffer.status === "declined" ? (
            <form
              className="space-y-3 border-t border-border pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!user) {
                  void navigate({ to: "/login" });
                  return;
                }
                offerMut.mutate();
              }}
            >
              <Label htmlFor="offer">Send an offer</Label>
              <Input
                id="offer"
                inputMode="decimal"
                placeholder={`Asking ${money(listing.priceCents)}`}
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                required
              />
              <Textarea placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button type="submit" variant="secondary" className="w-full" disabled={offerMut.isPending}>
                {offerMut.isPending ? "Sending…" : "Send offer"}
              </Button>
            </form>
          ) : null}

          <form
            className="space-y-2 border-t border-border pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!user) {
                void navigate({ to: "/login" });
                return;
              }
              msgMut.mutate();
            }}
          >
            <Label htmlFor="ask">Ask about this item</Label>
            <div className="flex gap-2">
              <Input id="ask" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Does the shade come with it?" />
              <Button type="submit" variant="secondary" size="icon" disabled={msgMut.isPending} aria-label="Send message">
                <MessageCircle />
              </Button>
            </div>
          </form>
          {data.messages.length > 0 ? (
            <ul className="space-y-2">
              {data.messages.map((m) => (
                <li key={m.id} className="rounded-xl bg-bg px-3 py-2 text-sm">
                  <span className="font-medium">@{m.fromHandle}</span>
                  <span className="ml-2 text-muted">{m.body}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      )}
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-bg px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-subtle">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

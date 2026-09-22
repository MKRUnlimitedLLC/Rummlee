import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, MapPin, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { AskingPrice, CheckoutPay } from "@/components/fee-line";
import { BuyerDealStatus, DealSteps } from "@/components/deal";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { errMessage, isUnauthorized } from "@/lib/rummlee/errors";
import { categoryLabel, haulLabel, money, payBaseCents, saleWindow } from "@/lib/rummlee/format";
import { checkoutQuote } from "@/lib/rummlee/fees";
import { buyNow, getListing, respondOffer, sendMessage, sendOffer, toggleSaved } from "@/lib/rummlee/server";

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
  const [offerOpen, setOfferOpen] = useState(false);

  if (!data?.listing) {
    return (
      <main className="py-16 text-center">
        <p className="text-muted">That listing isn’t here.</p>
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
  const officialOk = listing.handoffModes.includes("official");
  const personOk = listing.handoffModes.includes("person");
  const publicOk = listing.handoffModes.includes("public") && Boolean(data.publicSpot);
  const publicSpot = data.publicSpot;
  const mine = user?.id === listing.sellerId;
  const fees = data.fees ?? [];

  const meetChoices = [
    {
      id: "partner" as const,
      label: "Official store handoff",
      hint: listing.handoffSpotName ?? "Locker or pickup desk, store hours.",
      enabled: officialOk,
    },
    {
      id: "public" as const,
      label: "Public place handoff",
      hint: publicSpot ? publicSpot.name : "Not offered on this item.",
      enabled: publicOk,
    },
    {
      id: "person" as const,
      label: "In person handoff",
      hint: personOk ? "Meet as handles. Still no home address." : "Not offered on this item.",
      enabled: personOk,
    },
  ];
  const selected = meetChoices.some((choice) => choice.id === meet && choice.enabled)
    ? meet
    : (meetChoices.find((choice) => choice.enabled)?.id ?? "partner");
  const due = checkoutQuote(
    fees,
    base,
    premium,
    selected === "person" ? "person" : selected === "public" ? "public" : "official",
  );

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
      void qc.invalidateQueries({ queryKey: ["inbox"] });
      if (res.status === "accepted") toast.success("They said yes. Pay to hold it.");
      else if (res.status === "declined") toast.success("No deal on that offer. You can still pay asking.");
      else toast.success("Offer sent. They get one answer.");
      setOffer("");
      setOfferOpen(false);
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
          handoffType: selected === "person" ? "person" : "official",
          meet: selected,
          handoffSpotId: selected === "public" ? publicSpot?.id ?? null : null,
        },
      }),
    onSuccess: (res) => {
      toast.success("Paid. Held until you both confirm.");
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

  const passMut = useMutation({
    mutationFn: () => respondOffer({ data: { offerId: data.myOffer!.id, action: "decline" } }),
    onSuccess: () => {
      toast.success("Declined. The offer is over. You can still pay asking.");
      void qc.invalidateQueries({ queryKey: ["listing", id] });
      void qc.invalidateQueries({ queryKey: ["inbox"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

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
            <AskingPrice cents={listing.priceCents} originalCents={listing.originalCents} />
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
            Handoff location
          </span>
          <Link to="/sales/$id" params={{ id: listing.saleId }} className="block text-sm font-medium text-primary-ink">
            See the rest of this sale
          </Link>
          <p className="text-xs text-subtle">
            Neighbors see @{listing.sellerHandle} — never a real name or home address.
            {listing.handoffSpotKind === "partner" ? " Official store handoff." : listing.handoffSpotKind === "public" ? " Public place handoff." : ""}
          </p>
        </div>
      </div>

      {listing.status !== "live" ? (
        <p className="mt-5 rounded-2xl bg-surface px-4 py-6 text-center text-muted shadow-[var(--shadow-card)]">
          This one already sold.
        </p>
      ) : mine ? (
        <p className="mt-5 rounded-2xl bg-surface px-4 py-6 text-center text-muted shadow-[var(--shadow-card)]">
          This is your listing. Offers show up in{" "}
          <Link to="/inbox" className="font-medium text-primary-ink">
            Inbox
          </Link>
          . Yes, counteroffer, or decline. One decline ends it.
          {data.floorCents != null ? (
            <span className="mt-2 block text-sm">
              Lowest you’ll take (hidden): {money(data.floorCents)}
            </span>
          ) : null}
        </p>
      ) : (
        <section className="mt-5 space-y-4 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-xl font-semibold">Take it home</h2>
          <p className="text-sm text-muted">Three steps. Handoff location, agree on a price, pay to hold it. One offer. One decline each ends it.</p>
          <DealSteps
            current={
              data.myOffer?.status === "accepted" || data.myOffer?.status === "countered"
                ? 3
                : data.myOffer?.status === "pending"
                  ? 2
                  : 1
            }
          />
          <p className="text-sm font-medium">1. Handoff location</p>
          <p className="text-sm text-muted">Only what the seller offers. Never a home address.</p>
          <div className="space-y-2">
            {meetChoices.map((choice, index) => {
              const on = selected === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  disabled={!choice.enabled}
                  onClick={() => choice.enabled && setMeet(choice.id)}
                  className={
                    on
                      ? "flex w-full flex-col items-start rounded-2xl bg-primary px-4 py-3 text-left text-primary-fg"
                      : "flex w-full flex-col items-start rounded-2xl bg-bg px-4 py-3 text-left text-fg disabled:opacity-50"
                  }
                >
                  <span className="text-sm font-medium">
                    {index + 1}. {choice.label}
                  </span>
                  <span className={on ? "mt-0.5 text-xs text-primary-fg/80" : "mt-0.5 text-xs text-muted"}>
                    {choice.hint}
                  </span>
                </button>
              );
            })}
          </div>
          {selected === "partner" && listing.handoffSpotName ? (
            <div className="rounded-xl bg-bg px-3.5 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-primary-ink">Official store handoff</p>
              <p className="mt-1 font-medium">{listing.handoffSpotName}</p>
              <p className="text-sm text-muted">{listing.handoffSpotArea}</p>
              {listing.handoffSpotHint ? <p className="mt-1 text-sm text-subtle">{listing.handoffSpotHint}</p> : null}
            </div>
          ) : null}
          {selected === "public" && publicSpot ? (
            <div className="rounded-xl bg-bg px-3.5 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-subtle">Public place handoff</p>
              <p className="mt-1 font-medium">{publicSpot.name}</p>
              <p className="text-sm text-muted">{publicSpot.area}</p>
              <p className="mt-1 text-sm text-subtle">{publicSpot.hint}</p>
            </div>
          ) : null}
          {selected === "person" ? (
            <p className="rounded-xl bg-bg px-3.5 py-3 text-sm text-muted">
              In person handoff. You still meet as handles. No home address is posted.
            </p>
          ) : null}

          <p className="text-sm font-medium">2. Price</p>
          {data.myOffer && data.myOffer.status !== "declined" ? (
            <BuyerDealStatus offer={data.myOffer} />
          ) : (
            <p className="text-sm text-muted">Pay asking, or send one offer under it. Neighbors never see the seller’s lowest. One decline from either of you ends the offer.</p>
          )}

          <p className="text-sm font-medium">3. Pay to hold it</p>
          <CheckoutPay
            baseCents={base}
            premium={premium}
            fees={fees}
            handoff={selected === "person" ? "person" : selected === "public" ? "public" : "official"}
          />

          {data.myOffer?.status === "pending" ? (
            <div className="space-y-2">
              <Button
                className="w-full"
                variant="secondary"
                disabled={buyMut.isPending}
                onClick={() => (user ? buyMut.mutate() : navigate({ to: "/login" }))}
              >
                Pay asking instead · {money(checkoutQuote(fees, asking, premium, selected === "person" ? "person" : selected === "public" ? "public" : "official").youPayCents)}
              </Button>
              <Button className="w-full" variant="ghost" disabled={passMut.isPending} onClick={() => passMut.mutate()}>
                Decline
              </Button>
            </div>
          ) : data.myOffer?.status === "accepted" || data.myOffer?.status === "countered" ? (
            <div className="space-y-2">
              <Button className="w-full" disabled={buyMut.isPending} onClick={() => buyMut.mutate()}>
                {buyMut.isPending ? "Paying…" : `Pay ${money(due.youPayCents)} to hold it`}
              </Button>
              {data.myOffer.status === "countered" ? (
                <Button className="w-full" variant="ghost" disabled={passMut.isPending} onClick={() => passMut.mutate()}>
                  Decline
                </Button>
              ) : null}
            </div>
          ) : (
            <Button className="w-full" disabled={buyMut.isPending} onClick={() => (user ? buyMut.mutate() : navigate({ to: "/login" }))}>
              {buyMut.isPending ? "Paying…" : `Pay asking · ${money(due.youPayCents)}`}
            </Button>
          )}

          {!data.myOffer ? (
            offerOpen ? (
              <form
                className="space-y-3 border-t border-border pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!user) {
                    void navigate({ to: "/login" });
                    return;
                  }
                  const n = Math.round(Number(offer) * 100);
                  if (!Number.isFinite(n) || n < 100) {
                    toast.error("Enter a dollar amount.");
                    return;
                  }
                  if (n >= listing.priceCents) {
                    toast.error("That’s asking or more. Pay asking to hold it.");
                    return;
                  }
                  offerMut.mutate();
                }}
              >
                <Label htmlFor="offer">Your one offer</Label>
                <Input
                  id="offer"
                  inputMode="decimal"
                  placeholder={`Asking ${money(listing.priceCents)}`}
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  required
                />
                <Textarea placeholder="Optional note — condition, timing" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button type="submit" variant="secondary" className="w-full" disabled={offerMut.isPending}>
                  {offerMut.isPending ? "Sending…" : "Send offer"}
                </Button>
                <button type="button" className="w-full text-sm text-muted" onClick={() => setOfferOpen(false)}>
                  Cancel
                </button>
              </form>
            ) : (
              <button type="button" className="w-full text-sm font-medium text-primary-ink" onClick={() => setOfferOpen(true)}>
                Offer a different price
              </button>
            )
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
            <Label htmlFor="ask">Ask a question</Label>
            <div className="flex gap-2">
              <Input id="ask" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Does this still work?" />
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

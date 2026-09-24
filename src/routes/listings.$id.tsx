import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, MapPin, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { AskingPrice, CheckoutPay } from "@/components/fee-line";
import { BuyerDealStatus, DealSteps, SellerOfferCard } from "@/components/deal";
import { ThumbTally, VerifiedBadge } from "@/components/trust";
import { ListingNotes } from "@/components/listing-notes";
import { ListingFacts } from "@/components/listing-facts";
import { RummleeReveal } from "@/components/reveal";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { TEST_MODE } from "@/lib/rummlee/constants";
import { lastCity, loadSavedIds, rememberAfterLogin, toggleLocalSaved } from "@/lib/rummlee/draft";
import { errMessage, isUnauthorized } from "@/lib/rummlee/errors";
import { categoryLabel, cityOf, fitsOfficialCounter, haulLabel, liveWindowLine, money, onlineWindowLine, packLabel, payBaseCents, PERSON_ONLY_LINE, saleHasEnded, saleWhen } from "@/lib/rummlee/format";
import { buyNow, featureListing, getListing, markSoldOutside, respondOffer, sendMessage, sendOffer, setOvertime, toggleSaved, topUpWallet, stashListing, removeListing } from "@/lib/rummlee/server";
import { DEFAULT_FEES, checkoutQuote, feeById, formatFeeValue } from "@/lib/rummlee/fees";
import { dissolveBundle } from "@/lib/rummlee/bundles";

export const Route = createFileRoute("/listings/$id")({
  loader: ({ params }) => getListing({ data: params.id }),
  component: ListingPage,
});

function ListingPage() {
  const { id } = Route.useParams();
  const initial = Route.useLoaderData();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isPending } = useCurrentUserState();
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
  const [localSaved, setLocalSaved] = useState(false);
  const [needCredits, setNeedCredits] = useState(false);
  useEffect(() => {
    if (data?.listing) setLocalSaved(loadSavedIds().includes(data.listing.id));
  }, [data?.listing]);

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
  const saved = user ? listing.saved : localSaved;
  const ended = saleHasEnded(listing.saleEndsOn, listing.alwaysOn);
  const overtime = Boolean(ended && listing.status === "live" && listing.overtimeCents);
  const asking = overtime ? listing.overtimeCents! : listing.priceCents;
  const base = payBaseCents(asking, data.myOffer);
  const premium = Boolean(data.buyerPremium);
  const sellerPlus = Boolean(data.sellerPremium);
  const sellerTier = data.sellerTier === "trio" || data.sellerTier === "plus" ? data.sellerTier : null;
  const sides = { buyer: premium, sellerTier };
  const officialOk = listing.handoffModes.includes("official");
  const personOk = listing.handoffModes.includes("person");
  const publicOk = listing.handoffModes.includes("public") && Boolean(data.publicSpot);
  const publicSpot = data.publicSpot;
  const mine = user?.id === listing.sellerId;
  const fees = data.fees ?? [];
  const myOrder = data.myOrder;

  function goLogin(reason: string) {
    rememberAfterLogin(`/listings/${listing.id}`);
    toast.message(reason);
    void navigate({ to: "/login" });
  }

  const meetChoices = [
    {
      id: "partner" as const,
      label: "Official partner store",
      hint: listing.distanceLabel ?? "Rough distance until you pay.",
      enabled: officialOk,
    },
    {
      id: "public" as const,
      label: "Public handoff location",
      hint: publicSpot ? (listing.distanceLabel ?? publicSpot.name) : "Seller didn’t offer this on this item.",
      enabled: publicOk,
    },
    {
      id: "person" as const,
      label: "Private handoff",
      hint: personOk
        ? listing.distanceLabel ?? "Rough distance until you pay."
        : "Seller didn’t offer this on this item.",
      enabled: personOk,
    },
  ];
  const selected = meetChoices.some((choice) => choice.id === meet && choice.enabled)
    ? meet
    : (meetChoices.find((choice) => choice.enabled)?.id ?? "partner");
  const due = checkoutQuote(
    fees,
    base,
    { buyer: premium, sellerTier },
    selected === "person" ? "person" : selected === "public" ? "public" : "official",
  );
  const payingAgreed = data.myOffer?.status === "accepted" || data.myOffer?.status === "countered";
  const payBase = payingAgreed ? base : asking;
  const handoffKey = selected === "person" ? "person" : selected === "public" ? "public" : "official";
  const officialPay = checkoutQuote(fees, payBase, { buyer: premium, sellerTier }, "official").youPayCents;
  const otherPay = checkoutQuote(fees, payBase, { buyer: premium, sellerTier }, "public").youPayCents;

  const saveMut = useMutation({
    mutationFn: () => toggleSaved({ data: listing.id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["listing", id] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: (e) => {
      if (isUnauthorized(e)) {
        rememberAfterLogin(`/listings/${listing.id}`);
        toast.error("Your sign-in ended. Sign in again to save this. The listing stays here.");
        void navigate({ to: "/login" });
      } else toast.error(errMessage(e));
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
    onSuccess: async (res) => {
      await qc.refetchQueries({ queryKey: ["listing", id] });
      void qc.invalidateQueries({ queryKey: ["inbox"] });
      if (res.status === "accepted") toast.success("They said yes. Pay the agreed price to hold it.");
      else if (res.status === "declined") toast.success("No deal on that offer. You can still pay asking.");
      else toast.success("Offer sent. They get one answer — yes, counteroffer, or decline.");
      setOffer("");
      setOfferOpen(false);
    },
    onError: (e) => {
      if (isUnauthorized(e)) {
        rememberAfterLogin(`/listings/${listing.id}`);
        toast.error("Sign in to send that offer.");
        void navigate({ to: "/login" });
      } else toast.error(errMessage(e));
    },
  });

  const buyMut = useMutation({
    mutationFn: (payAsking: boolean) =>
      buyNow({
        data: {
          listingId: listing.id,
          amountCents: payAsking ? asking : base,
          payAsking,
          handoffType: selected === "person" ? "person" : "official",
          meet: selected,
          handoffSpotId: selected === "public" ? publicSpot?.id ?? null : null,
        },
      }),
    onSuccess: (res) => {
      setNeedCredits(false);
      toast.success(TEST_MODE ? "Your money is held. Test credits, not a card." : "Your money is held until you both confirm pickup.");
      void qc.invalidateQueries({ queryKey: ["listing", id] });
      void navigate({ to: "/pickup/$id", params: { id: res.orderId } });
    },
    onError: (e) => {
      void qc.invalidateQueries({ queryKey: ["listing", id] });
      if (isUnauthorized(e)) {
        rememberAfterLogin(`/listings/${listing.id}`);
        toast.error("Sign in to pay.");
        void navigate({ to: "/login" });
        return;
      }
      const msg = errMessage(e);
      if (/test credits|wallet/i.test(msg)) {
        setNeedCredits(true);
        toast.error("Add test credits here, then pay again. This item is still available.");
        return;
      }
      toast.error(msg);
    },
  });

  const msgMut = useMutation({
    mutationFn: () => sendMessage({ data: { listingId: listing.id, body: ask } }),
    onSuccess: () => {
      setAsk("");
      void qc.invalidateQueries({ queryKey: ["listing", id] });
    },
    onError: (e) => {
      if (isUnauthorized(e)) {
        rememberAfterLogin(`/listings/${listing.id}`);
        toast.error("Your sign-in ended. Sign in again to send that note.");
        void navigate({ to: "/login" });
      } else toast.error(errMessage(e));
    },
  });

  const addCredits = useMutation({
    mutationFn: () => topUpWallet({ data: 2000 }),
    onSuccess: () => {
      setNeedCredits(false);
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Test credits added. Not real money. Pay again.");
    },
    onError: (e) => toast.error(errMessage(e)),
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

  const dissolve = useMutation({
    mutationFn: () => dissolveBundle({ data: { listingId: listing.id } }),
    onSuccess: () => {
      toast.success("Bundle taken down. The items are listed on their own again.");
      void qc.invalidateQueries({ queryKey: ["listing", id] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const sellerMut = useMutation({
    mutationFn: (data: { offerId: string; action: "accept" | "decline" | "counter"; counterCents?: number }) =>
      respondOffer({ data }),
    onSuccess: async (_res, vars) => {
      await qc.refetchQueries({ queryKey: ["listing", id] });
      void qc.invalidateQueries({ queryKey: ["inbox"] });
      if (vars.action === "accept") toast.success("You said yes. Waiting for them to pay. Not sold yet.");
      else if (vars.action === "counter") toast.success("Counteroffer sent.");
      else toast.success("Offer ended. They can still pay asking.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const featureMut = useMutation({
    mutationFn: () => featureListing({ data: { listingId: listing.id } }),
    onSuccess: (res) => {
      toast.success(res.chargeCents > 0 ? `Featured. Paid with ${res.paidNote}.` : "Featured.");
      void qc.invalidateQueries({ queryKey: ["listing", id] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const outsideMut = useMutation({
    mutationFn: () => markSoldOutside({ data: { listingId: listing.id } }),
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: ["listing", id] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
      toast.success("Ended. Sold outside Rummlee. Open offers are closed. No hold was taken.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const stashMut = useMutation({
    mutationFn: () => stashListing({ data: { listingId: listing.id } }),
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: ["listing", id] });
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Stashed. It stays in your inventory until you put it on a sale.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const removeMut = useMutation({
    mutationFn: () => removeListing({ data: { listingId: listing.id } }),
    onSuccess: async () => {
      toast.success("Removed from your inventory.");
      void navigate({ to: "/you" });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <article className="py-5">
      <div className="overflow-hidden rounded-[24px] bg-surface shadow-[var(--shadow-card)]">
        <div className="relative aspect-[4/5] bg-bg-warm sm:aspect-[4/3]">
          <img src={listing.photoUrl} alt={listing.title} className="size-full object-cover" />
          <span className="absolute left-3 top-3 rounded-md bg-surface/92 px-2 py-1 text-sm font-medium backdrop-blur-sm">
            {saleWhen(listing.saleStartsOn, listing.saleEndsOn, listing.alwaysOn)}
          </span>
          <button
            type="button"
            aria-label={saved ? "Unsave" : "Save"}
            className="absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-surface/92 text-fg shadow-[var(--shadow-card)] backdrop-blur-sm"
            onClick={() => {
              if (!user) {
                const on = toggleLocalSaved(listing.id);
                setLocalSaved(on);
                toast.success(on ? "Saved on this device." : "Removed from this device.");
                return;
              }
              saveMut.mutate();
            }}
          >
            {saved ? <BookmarkCheck className="size-5" /> : <Bookmark className="size-5" />}
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{listing.title}</h1>
            {listing.priceHidden ? (
              <p className="text-base text-muted">Early look for +++. The price shows when this sale starts. Favorite it and come back.</p>
            ) : listing.upcoming ? (
              <p className="text-sm text-muted">Not public yet. +++ can see this without the price.</p>
            ) : null}
            {listing.priceHidden ? null : <AskingPrice cents={listing.priceCents} originalCents={listing.originalCents} />}
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-muted">
              <MapPin className="size-3.5" />
              {listing.handoffSpotName ?? listing.neighborhood} · {listing.neighborhood} · @{listing.sellerHandle}
              <VerifiedBadge verified={listing.sellerVerified} />
              <ThumbTally up={listing.sellerThumbsUp} down={listing.sellerThumbsDown} />
              {listing.sellerId.startsWith("seed-") ? null : (
                <Link to="/rep" className="font-medium text-primary-ink">
                  Rep {listing.sellerRep ?? 100}
                </Link>
              )}
            </p>
            {lastCity() && lastCity() !== "all" && cityOf(listing.neighborhood) !== lastCity() ? (
              <p className="rounded-xl bg-primary-soft px-3 py-2 text-sm text-fg">
                Pickup is in {cityOf(listing.neighborhood)}, not {lastCity()}. City chips on Browse only show that metro.
              </p>
            ) : null}
          </div>
          {listing.sellerId.startsWith("seed-") ? (
            <p className="text-base font-medium text-primary-ink">Sample listing. Not a real item. Pay is still test credits.</p>
          ) : null}
          {listing.charitySplit ? (
            <p className="rounded-xl bg-primary-soft px-3 py-2 text-base text-fg">
              Left at an official store. Rummlee is reselling it. Pay asking. Half of what Rummlee receives goes to charity.
            </p>
          ) : null}
          <p className="text-pretty text-base leading-relaxed text-fg">{listing.description}</p>
          <ListingNotes listingId={listing.id} mine={mine} signedIn={Boolean(user)} />
          <ListingFacts listingId={listing.id} mine={mine} signedIn={Boolean(user)} />
          {onlineWindowLine(listing) ? <p className="text-base text-muted">{onlineWindowLine(listing)}</p> : null}
          {liveWindowLine(listing) ? (
            <p className="text-base text-fg">{liveWindowLine(listing)} · In person · hours only. No home address.</p>
          ) : null}
          {data.meetupNote ? (
            <p className="rounded-xl bg-primary-soft px-3 py-2 text-base text-fg">
              Private handoff address: {data.meetupNote}
            </p>
          ) : null}
          <dl className="grid grid-cols-2 gap-2 text-base">
            <Meta label="Condition" value={listing.condition} />
            <Meta label="Category" value={categoryLabel(listing.category)} />
            <Meta label="Haul" value={haulLabel(listing.haul)} />
            {listing.sizeLabel ? <Meta label="Size" value={listing.sizeLabel} /> : null}
            {packLabel(listing.pack) ? <Meta label="Packed" value={packLabel(listing.pack) ?? ""} /> : null}
            {listing.weightLbs ? <Meta label="Weight" value={`${listing.weightLbs} lb`} /> : null}
            {!fitsOfficialCounter(listing) ? <p className="text-base text-fg sm:col-span-2">{PERSON_ONLY_LINE}</p> : null}
            <Meta label="Sale" value={listing.saleName} />
          </dl>
          <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary-ink">
            Handoff location
          </span>
          {data.bundleItems?.length ? (
            <ul className="space-y-1 text-base text-fg">
              {data.bundleItems.map((item) => (
                <li key={item.id}>
                  {item.title} · {money(item.priceCents)}
                </li>
              ))}
            </ul>
          ) : null}
          {listing.charitySplit ? null : (
          <Link
            to="/bundle"
            search={{ seller: listing.sellerId, from: listing.id }}
            className="block text-base font-medium text-primary-ink"
          >
            {mine ? "Bundle items from this sale" : "Bundle other items from this seller"}
          </Link>
          )}
          <Link to="/sales/$id" params={{ id: listing.saleId }} className="block text-base font-medium text-primary-ink">
            See the rest of this sale
          </Link>
          <p className="text-sm text-subtle">
            Neighbors see @{listing.sellerHandle} — never a real name or home address.
            {listing.handoffSpotKind === "partner" ? " Official store handoff." : listing.handoffSpotKind === "public" ? " Public place handoff." : ""}
          </p>
        </div>
      </div>

      {listing.status !== "live" && listing.status !== "bundle" && listing.status !== "stashed" ? (
        myOrder ? (
          <section className="mt-5 space-y-3 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
            <h2 className="font-display text-xl font-semibold">
              {myOrder.status === "escrow" ? "Your money is held" : "Picked up"}
            </h2>
            <p className="text-base text-muted">
              {myOrder.status === "escrow"
                ? "Test credits are held until you both confirm pickup. This listing is spoken for — not sold to someone else."
                : "Pickup confirmed. The hold released."}
            </p>
            <Button asChild className="w-full">
              <Link to="/pickup/$id" params={{ id: myOrder.id }}>
                {myOrder.status === "escrow" ? "Open pickup code" : "View pickup"}
              </Link>
            </Button>
          </section>
        ) : (
          <p className="mt-5 rounded-2xl bg-surface px-4 py-6 text-center text-muted shadow-[var(--shadow-card)]">
            {listing.status === "held" ? "Someone’s already holding this. Your money would stay held until pickup." : listing.status === "outside" ? "Ended. Sold outside Rummlee. No hold was taken." : listing.status === "abandoned" ? "Left with Rummlee. The first seller’s handle is not on a resale." : listing.status === "bundled" ? "This item is in a bundle." : "This one already sold."}
          </p>
        )
      ) : mine ? (
        <section className="mt-5 space-y-4 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-xl font-semibold">Your listing</h2>
          <p className="text-base text-muted">
            Yes, counteroffer, or decline. One decline ends the offer.
            {data.floorCents != null ? ` Lowest you’ll take (hidden): ${money(data.floorCents)}.` : ""}
          </p>
          {data.bundleKind === "seller" ? (
            <Button variant="secondary" disabled={dissolve.isPending} onClick={() => dissolve.mutate()}>
              {dissolve.isPending ? "Taking it down…" : "Put the items back on their own"}
            </Button>
          ) : null}
          {(data.sellerOffers ?? []).length ? (
            <ul className="space-y-3">
              {(data.sellerOffers ?? []).map((o) => (
                <SellerOfferCard
                  key={o.id}
                  offer={o}
                  busy={sellerMut.isPending}
                  onAccept={() => sellerMut.mutate({ offerId: o.id, action: "accept" })}
                  onPass={() => sellerMut.mutate({ offerId: o.id, action: "decline" })}
                  onCounter={(cents) => sellerMut.mutate({ offerId: o.id, action: "counter", counterCents: cents })}
                />
              ))}
            </ul>
          ) : (
            <p className="text-base text-muted">No offers yet. They also show in Inbox.</p>
          )}
          <p className="text-sm text-muted">Taken from test credits, then from the next payout. It shows first until the sale ends.</p>
          {listing.featured ? (
            <p className="text-sm font-medium text-primary-ink">Featured until this sale ends.</p>
          ) : listing.status === "live" ? (
            <Button variant="secondary" disabled={featureMut.isPending} onClick={() => featureMut.mutate()}>
              {featureMut.isPending
                ? "Featuring…"
                : `Feature this item · ${formatFeeValue(feeById(DEFAULT_FEES, "feature_item") ?? DEFAULT_FEES[0])}`}
            </Button>
          ) : null}
          <Button asChild variant="secondary" className="w-full">
            <Link to="/listings/new">Add another item to this sale</Link>
          </Button>
          {listing.status === "live" || listing.status === "stashed" ? (
            <div className="flex flex-wrap gap-2">
              {listing.status === "live" ? (
                <Button type="button" variant="secondary" onClick={() => stashMut.mutate()}>
                  {stashMut.isPending ? "Stashing…" : "Stash for later"}
                </Button>
              ) : (
                <p className="text-sm text-muted">Stashed. It isn’t on a sale. Put it on one from You.</p>
              )}
              <Button type="button" variant="ghost" onClick={() => removeMut.mutate()}>
                {removeMut.isPending ? "Removing…" : "Remove"}
              </Button>
            </div>
          ) : null}
          {listing.status === "live" ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={outsideMut.isPending}
              onClick={() => outsideMut.mutate()}
            >
              {outsideMut.isPending ? "Ending…" : "Sold outside app"}
            </Button>
          ) : null}
        </section>
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
          <p className="text-sm text-muted">Always a handoff. The address shows after you pay. Until then, a rough distance. Rummlee never ships.</p>
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
                  <span className={on ? "mt-0.5 text-sm text-primary-fg/80" : "mt-0.5 text-sm text-muted"}>
                    {choice.enabled
                      ? choice.hint
                      : choice.id === "person"
                        ? "Not offered — optional. The seller left this off."
                        : "Seller didn’t offer this on this item."}
                  </span>
                </button>
              );
            })}
          </div>
          {data.paidAddress ? (
            <div className="rounded-xl bg-bg px-3.5 py-3">
              <p className="text-sm font-medium uppercase tracking-wider text-primary-ink">Address</p>
              <p className="mt-1 font-medium">{data.paidAddress}</p>
              {listing.distanceLabel ? <p className="text-sm text-muted">{listing.distanceLabel}</p> : null}
            </div>
          ) : selected === "partner" && listing.handoffSpotName ? (
            <div className="rounded-xl bg-bg px-3.5 py-3">
              <p className="text-sm font-medium uppercase tracking-wider text-primary-ink">Official partner store</p>
              <p className="mt-1 font-medium">{listing.handoffSpotName}</p>
              <p className="text-sm text-muted">{listing.distanceLabel ?? listing.handoffSpotArea}</p>
            </div>
          ) : selected === "public" && publicSpot ? (
            <div className="rounded-xl bg-bg px-3.5 py-3">
              <p className="text-sm font-medium uppercase tracking-wider text-subtle">Public handoff location</p>
              <p className="mt-1 font-medium">{publicSpot.name}</p>
              <p className="text-sm text-muted">{listing.distanceLabel ?? publicSpot.area}</p>
            </div>
          ) : selected === "person" ? (
            <p className="rounded-xl bg-bg px-3.5 py-3 text-sm text-muted">
              Private handoff. {listing.distanceLabel ?? "The address shows after you pay."} Rummlee never ships.
            </p>
          ) : null}
          {officialOk && officialPay !== otherPay ? (
            <p className="text-base text-fg">
              Official store: you pay {money(officialPay)}. Public or in person: {money(otherPay)}. The store fee is the difference.
            </p>
          ) : null}

          <p className="text-sm font-medium">2. Price</p>
          {ended && !overtime && !mine ? (
            <p className="text-sm text-muted">This sale has ended. +++ can make one more offer only if the seller sets a get-rid-of-it price.</p>
          ) : null}
          {overtime ? (
            <p className="text-sm text-muted">Overtime for +++. One more offer under the get-rid-of-it price, or pay that price. The seller’s old lowest stays hidden.</p>
          ) : null}
          {mine && ended && listing.status === "live" && !listing.charitySplit ? <OvertimePrice listingId={listing.id} current={listing.overtimeCents ?? null} asking={listing.priceCents} /> : null}
          {listing.charitySplit || (ended && !overtime) || listing.priceHidden ? null : <RummleeReveal listingId={listing.id} signedIn={Boolean(user)} />}
          {listing.priceHidden || (ended && !overtime) ? null : data.myOffer?.status === "declined" ? (
            <p className="text-sm text-muted">
              {overtime
                ? "Your overtime offer ended. Pay the get-rid-of-it price to hold it."
                : data.myOffer.declinedBy === "floor"
                  ? "Too low. Your one offer ended — the seller’s lowest stays hidden. Pay asking to hold it."
                  : "Your one offer ended. Pay asking to hold it — you can’t send another."}
            </p>
          ) : data.myOffer ? (
            <BuyerDealStatus offer={data.myOffer} />
          ) : (
            <p className="text-sm text-muted">
              {overtime
                ? "Pay the get-rid-of-it price, or send one offer under it. One decline ends the overtime offer."
                : "Pay asking, or send one offer under it. Neighbors never see the seller’s lowest. One decline from either of you ends the offer."}
            </p>
          )}

          {(ended && !overtime) || listing.priceHidden ? null : (
          <>
          <p className="text-sm font-medium">3. Pay to hold it</p>
          <p className="text-base text-fg">
            {overtime ? "Get rid of it" : "Asking"} {money(payBase)}. You pay {money(due.youPayCents)}
            {TEST_MODE ? " in test credits" : ""}.
          </p>
          <CheckoutPay
            baseCents={payBase}
            premium={premium}
            sellerPlus={sellerPlus}
            sellerTier={sellerTier}
            fees={fees}
            handoff={handoffKey}
            priceLabel={payingAgreed ? "Agreed" : overtime ? "Get rid of it" : "Asking"}
          />
          {needCredits ? (
            <div className="space-y-2 rounded-xl bg-primary-soft px-3 py-3">
              <p className="text-base text-fg">
                Not enough test credits for {money(due.youPayCents)}. The item is still available.
              </p>
              <Button type="button" variant="secondary" className="w-full" disabled={addCredits.isPending} onClick={() => addCredits.mutate()}>
                {addCredits.isPending ? "Adding test credits…" : "Add $20 test credits"}
              </Button>
            </div>
          ) : null}
          {data.myOffer?.status === "accepted" || data.myOffer?.status === "countered" ? (
            <p className="text-base text-muted">
              Agreed offer {money(base)} · {TEST_MODE ? "test " : ""}you pay {money(due.youPayCents)} if you take that deal.
            </p>
          ) : null}

          {data.myOffer?.status === "pending" ? (
            <div className="space-y-2">
              <Button
                className="w-full"
                variant="secondary"
                disabled={buyMut.isPending || isPending}
                onClick={() => (user ? buyMut.mutate(true) : goLogin("Sign in to pay asking."))}
              >
                {TEST_MODE
                  ? `Pay asking with test credits · ${money(checkoutQuote(fees, asking, { buyer: premium, sellerTier }, selected === "person" ? "person" : selected === "public" ? "public" : "official").youPayCents)}`
                  : `Pay asking · ${money(checkoutQuote(fees, asking, { buyer: premium, sellerTier }, selected === "person" ? "person" : selected === "public" ? "public" : "official").youPayCents)}`}
              </Button>
              <Button className="w-full" variant="ghost" disabled={passMut.isPending || !user} onClick={() => (user ? passMut.mutate() : goLogin("Sign in to decline."))}>
                Decline
              </Button>
            </div>
          ) : data.myOffer?.status === "accepted" || data.myOffer?.status === "countered" ? (
            <div className="space-y-2">
              <Button
                className="w-full"
                disabled={buyMut.isPending || isPending}
                onClick={() => (user ? buyMut.mutate(false) : goLogin("Sign in to pay and hold it."))}
              >
                {buyMut.isPending
                  ? TEST_MODE
                    ? "Paying with test credits…"
                    : "Paying…"
                  : TEST_MODE
                    ? `Pay agreed ${money(due.youPayCents)} with test credits`
                    : `Pay agreed ${money(due.youPayCents)} to hold it`}
              </Button>
              {data.myOffer.status === "countered" ? (
                <Button className="w-full" variant="ghost" disabled={passMut.isPending || !user} onClick={() => (user ? passMut.mutate() : goLogin("Sign in to decline."))}>
                  Decline
                </Button>
              ) : null}
            </div>
          ) : user ? (
            <Button className="w-full" disabled={buyMut.isPending || isPending} onClick={() => buyMut.mutate(true)}>
              {buyMut.isPending
                ? TEST_MODE
                  ? "Paying with test credits…"
                  : "Paying…"
                : TEST_MODE
                  ? `Pay asking with test credits · ${money(checkoutQuote(fees, asking, { buyer: premium, sellerTier }, selected === "person" ? "person" : selected === "public" ? "public" : "official").youPayCents)}`
                  : `Pay asking · ${money(checkoutQuote(fees, asking, { buyer: premium, sellerTier }, selected === "person" ? "person" : selected === "public" ? "public" : "official").youPayCents)}`}
            </Button>
          ) : (
            <Button className="w-full" disabled={isPending} onClick={() => goLogin("Sign in to pay. Browse stays free.")}>
              Sign in to pay asking · {money(checkoutQuote(fees, asking, { buyer: premium, sellerTier }, selected === "person" ? "person" : selected === "public" ? "public" : "official").youPayCents)}
            </Button>
          )}

          {!data.myOffer && !listing.charitySplit && !(ended && !overtime) && !listing.priceHidden ? (
            offerOpen ? (
              <form
                className="space-y-3 border-t border-border pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!user) {
                    goLogin("Sign in to send that offer.");
                    return;
                  }
                  const n = Math.round(Number(offer) * 100);
                  if (!Number.isFinite(n) || n < 100) {
                    toast.error("Enter a dollar amount.");
                    return;
                  }
                  if (n >= asking) {
                    toast.error(overtime ? "That’s the get-rid-of-it price or more. Pay that to hold it." : "That’s asking or more. Pay asking to hold it.");
                    return;
                  }
                  offerMut.mutate();
                }}
              >
                <Label htmlFor="offer">{overtime ? "Your overtime offer" : "Your one offer"}</Label>
                <Input
                  id="offer"
                  inputMode="decimal"
                  placeholder={`${overtime ? "Get rid of it" : "Asking"} ${money(asking)}`}
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  required
                />
                <Textarea placeholder="Optional note — condition, timing" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button type="submit" variant="secondary" className="w-full" disabled={offerMut.isPending}>
                  {offerMut.isPending ? "Sending…" : user ? "Send offer" : "Sign in to send offer"}
                </Button>
                <button type="button" className="w-full text-sm text-muted" onClick={() => setOfferOpen(false)}>
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="w-full text-base font-medium text-primary-ink"
                onClick={() => {
                  if (!user) {
                    goLogin("Sign in to send an offer.");
                    return;
                  }
                  setOfferOpen(true);
                }}
              >
                {user ? "Offer a different price" : "Sign in to send an offer"}
              </button>
            )
          ) : null}
          </>
          )}

          {listing.charitySplit ? (
            <p className="border-t border-border pt-4 text-sm text-muted">Pay asking. Questions aren’t open on shelf items.</p>
          ) : (
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
          )}
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
      <dt className="text-sm uppercase tracking-wide text-subtle">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function OvertimePrice({ listingId, current, asking }: { listingId: string; current: number | null; asking: number }) {
  const qc = useQueryClient();
  const [dollars, setDollars] = useState(current == null ? "" : String(current / 100));
  const save = useMutation({
    mutationFn: (cents: number | null) => setOvertime({ data: { listingId, cents } }),
    onSuccess: (res) => {
      toast.success(res.overtimeCents ? "Overtime is on for +++." : "Overtime is off.");
      void qc.invalidateQueries({ queryKey: ["listing", listingId] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  return (
    <form
      className="space-y-2 rounded-xl bg-bg px-3 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        const cents = Math.round(Number(dollars) * 100);
        if (!Number.isFinite(cents)) return;
        save.mutate(cents);
      }}
    >
      <p className="text-sm font-medium">Get rid of it price</p>
      <p className="text-sm text-muted">+++ members only. They can pay this, or make one offer under it. Asking was {money(asking)}.</p>
      <Input inputMode="decimal" value={dollars} onChange={(e) => setDollars(e.target.value)} placeholder="25" />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? "Saving…" : current ? "Update overtime" : "Open overtime"}
        </Button>
        {current ? (
          <Button type="button" size="sm" variant="secondary" disabled={save.isPending} onClick={() => save.mutate(null)}>
            Turn off
          </Button>
        ) : null}
      </div>
    </form>
  );
}

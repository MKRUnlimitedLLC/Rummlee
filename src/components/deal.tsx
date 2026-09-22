import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { agreedOfferCents, money, offerHeadline } from "@/lib/rummlee/format";
import type { Offer } from "@/lib/rummlee/types";
import { cn } from "@/lib/utils";

const STEPS = ["Handoff", "Price", "Pay"] as const;

export function DealSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="grid grid-cols-3 gap-1 text-center text-xs font-medium">
      {STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const on = n === current;
        const done = n < current;
        return (
          <li
            key={label}
            className={cn(
              "rounded-full px-2 py-1.5",
              on ? "bg-primary text-primary-fg" : done ? "bg-primary-soft text-primary-ink" : "bg-bg text-muted",
            )}
          >
            {n}. {label}
          </li>
        );
      })}
    </ol>
  );
}

export function BuyerDealStatus({ offer }: { offer: Offer }) {
  const agreed = agreedOfferCents(offer);
  if (offer.status === "pending") {
    return (
      <div className="rounded-2xl bg-primary-soft px-4 py-3">
        <p className="text-sm font-medium text-primary-ink">{offerHeadline(offer.status)}</p>
        <p className="mt-1 text-sm text-fg">
          You offered {money(offer.amountCents)}. They can say yes, send a counteroffer, or decline. One decline ends the offer.
        </p>
      </div>
    );
  }
  if (offer.status === "countered") {
    return (
      <div className="rounded-2xl bg-primary-soft px-4 py-3">
        <p className="text-sm font-medium text-primary-ink">{offerHeadline(offer.status)}</p>
        <p className="mt-1 text-sm text-fg">
          You offered {money(offer.amountCents)}. Their counteroffer is {money(agreed)}. Pay that, or decline — that ends
          the offer. You can still pay asking.
        </p>
      </div>
    );
  }
  if (offer.status === "accepted") {
    return (
      <div className="rounded-2xl bg-primary-soft px-4 py-3">
        <p className="text-sm font-medium text-primary-ink">{offerHeadline(offer.status)}</p>
        <p className="mt-1 text-sm text-fg">
          Agreed at {money(agreed)}. Pay to hold it — then meet at the handoff location.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-bg px-4 py-3">
      <p className="text-sm font-medium">{offerHeadline(offer.status)}</p>
      <p className="mt-1 text-sm text-muted">
        {offer.declinedBy === "floor"
          ? "No deal on that offer. You can still pay asking."
          : "Someone declined. The offer is over. You can still pay asking."}
      </p>
    </div>
  );
}

export function SellerOfferCard({
  offer,
  busy,
  onAccept,
  onPass,
  onCounter,
}: {
  offer: Offer;
  busy: boolean;
  onAccept: () => void;
  onPass: () => void;
  onCounter: (cents: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(
    String(((offer.counterCents ?? offer.listingPriceCents) / 100).toFixed(offer.listingPriceCents % 100 ? 2 : 0)),
  );
  const openDeal = offer.status === "pending" || offer.status === "countered";
  const agreed = agreedOfferCents(offer);

  return (
    <li className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
      <Link to="/listings/$id" params={{ id: offer.listingId }} className="flex gap-3">
        <img src={offer.listingPhoto} alt={offer.listingTitle} className="size-16 rounded-lg object-cover" />
        <div className="min-w-0">
          <p className="font-medium">{offer.listingTitle}</p>
          <p className="text-sm text-muted">
            @{offer.buyerHandle} offered {money(offer.amountCents)}
            {offer.listingPriceCents ? ` · asking ${money(offer.listingPriceCents)}` : ""}
          </p>
          {offer.note ? <p className="mt-1 text-sm text-fg">“{offer.note}”</p> : null}
        </div>
      </Link>

      {offer.status === "pending" ? (
        <p className="mt-3 text-sm font-medium text-primary-ink">Yes, counteroffer, or decline. One decline ends it.</p>
      ) : offer.status === "countered" ? (
        <p className="mt-3 text-sm text-muted">Your counteroffer: {money(agreed)}. Waiting for them to pay or decline.</p>
      ) : offer.status === "accepted" ? (
        <p className="mt-3 text-sm text-muted">You said yes at {money(agreed)}. Waiting for them to pay.</p>
      ) : (
        <p className="mt-3 text-sm text-muted">Offer ended. They can still pay asking.</p>
      )}

      {openDeal && offer.status === "pending" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={onAccept}>
            Yes, {money(offer.amountCents)}
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setOpen((v) => !v)}>
            Counteroffer
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={onPass}>
            Decline
          </Button>
        </div>
      ) : null}

      {open ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Math.round(Number(amount) * 100);
            if (!Number.isFinite(n) || n < 100) return;
            onCounter(n);
            setOpen(false);
          }}
        >
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="New price in dollars"
            className="max-w-32"
          />
          <Button type="submit" size="sm" disabled={busy}>
            Send counteroffer
          </Button>
        </form>
      ) : null}
    </li>
  );
}

export function OutgoingOfferCard({ offer }: { offer: Offer }) {
  const agreed = agreedOfferCents(offer);
  const next =
    offer.status === "accepted" || offer.status === "countered"
      ? `Pay ${money(agreed)} to hold it`
      : offer.status === "pending"
        ? "Waiting — one answer left"
        : "Offer ended";
  return (
    <li>
      <Link
        to="/listings/$id"
        params={{ id: offer.listingId }}
        className="flex gap-3 rounded-2xl bg-surface p-3 shadow-[var(--shadow-card)]"
      >
        <img src={offer.listingPhoto} alt={offer.listingTitle} className="size-16 rounded-lg object-cover" />
        <div>
          <p className="font-medium">{offer.listingTitle}</p>
          <p className="text-sm text-muted">
            {offerHeadline(offer.status)} · you offered {money(offer.amountCents)}
            {offer.status === "countered" && offer.counterCents ? ` · they asked ${money(offer.counterCents)}` : ""}
          </p>
          <p className="mt-1 text-sm font-medium text-primary-ink">{next}</p>
        </div>
      </Link>
    </li>
  );
}

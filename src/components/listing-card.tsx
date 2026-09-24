import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { VerifiedBadge } from "@/components/trust";
import type { Listing } from "@/lib/rummlee/types";
import { HOLD_LINE } from "@/lib/rummlee/constants";
import { checkoutQuote, DEFAULT_FEES } from "@/lib/rummlee/fees";
import { fitsOfficialCounter, liveWindowLine, money, onlineWindowLine, packLabel, placeName, saleWhen, spotKindLabel } from "@/lib/rummlee/format";
import { cn } from "@/lib/utils";

export function ListingCard({ listing }: { listing: Listing; premium?: boolean }) {
  const partner = listing.handoffModes.includes("official") && listing.handoffSpotKind === "partner";
  const counter = fitsOfficialCounter(listing);
  const youPay = checkoutQuote(DEFAULT_FEES, listing.priceCents, false, counter ? "official" : "person").youPayCents;
  const feeHint = youPay > listing.priceCents;
  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="group block overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-smooth)] hover:shadow-[var(--shadow-card-hover)] active:scale-[0.99]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-bg-warm sm:aspect-[4/3]">
        <img
          src={listing.photoUrl}
          alt={listing.title}
          className="size-full object-cover transition-transform duration-500 ease-[var(--ease-out-smooth)] group-hover:scale-[1.03]"
        />
        <span className="absolute left-2.5 top-2.5 rounded-md bg-surface/92 px-2 py-1 text-sm font-medium text-fg backdrop-blur-sm">
          {saleWhen(listing.saleStartsOn, listing.saleEndsOn, listing.alwaysOn)}
        </span>
        {listing.sellerId.startsWith("seed-") ? (
          <span className="absolute right-2.5 top-2.5 rounded-md bg-surface/92 px-2 py-1 text-sm font-medium text-fg">
            Sample
          </span>
        ) : null}
        {listing.featured ? (
          <span className="absolute bottom-2.5 left-2.5 rounded-md bg-primary-ink px-2 py-1 text-sm font-medium text-primary-fg">
            Featured
          </span>
        ) : null}
        {listing.status === "sold" || listing.status === "held" ? (
          <span
            className={cn(
              "absolute right-2.5 rounded-md bg-fg/85 px-2 py-1 text-sm font-medium text-primary-fg",
              listing.sellerId.startsWith("seed-") ? "top-11" : "top-2.5",
            )}
          >
            {listing.status === "held" ? "Held" : "Sold"}
          </span>
        ) : null}
        {partner ? (
          <span className="absolute bottom-2.5 left-2.5 rounded-md bg-primary px-2 py-1 text-sm font-medium text-primary-fg">
            Official store
          </span>
        ) : null}
      </div>
      <div className="space-y-1.5 p-3.5">
        <h3 className="font-display text-lg font-semibold leading-snug tracking-[-0.02em] text-fg">
          {listing.title}
        </h3>
        {listing.sizeLabel ? (
          <p className="text-base font-medium text-fg">{listing.sizeLabel}</p>
        ) : null}
        <p className="font-display text-2xl font-semibold tracking-[-0.03em] text-primary-ink">{money(listing.priceCents)}</p>
        {listing.sellerId.startsWith("seed-") ? (
          <p className="text-base font-medium text-primary-ink">Sample. Not a real item.</p>
        ) : null}
        {listing.status === "held" ? (
          <p className="text-base font-medium text-fg">Held by someone else. Pick another.</p>
        ) : null}
        {feeHint ? (
          <p className="text-base text-muted">About {money(youPay)} with fee</p>
        ) : null}
        <p className="text-base font-medium text-primary-ink">{HOLD_LINE}</p>
        {onlineWindowLine(listing) ? <p className="text-base text-muted">{onlineWindowLine(listing)}</p> : null}
        {liveWindowLine(listing) ? (
          <p className="text-base text-fg">{liveWindowLine(listing)} · Neighborhood meetup after you pay</p>
        ) : null}
        {listing.charitySplit ? (
          <p className="text-base text-muted">Left at the store. Half of what Rummlee receives goes to charity.</p>
        ) : null}
        {packLabel(listing.pack) ? <p className="text-base text-muted">{packLabel(listing.pack)}</p> : null}
        {!counter ? <p className="text-base font-medium text-fg">In person only</p> : null}
        <p className="flex items-center gap-1 text-base text-muted">
          <MapPin className="size-3.5" strokeWidth={1.75} />
          {listing.handoffSpotName ?? listing.neighborhood}
          {" · "}
          {placeName(listing.neighborhood)}
        </p>
        <p className="text-base text-subtle">
          {listing.handoffSpotKind ? spotKindLabel(listing.handoffSpotKind) : "Handoff location"}
          {" · "}@{listing.sellerHandle}
          {listing.sellerVerified ? (
            <>
              {" · "}
              <VerifiedBadge verified className="align-middle" />
            </>
          ) : null}
        </p>
      </div>
    </Link>
  );
}
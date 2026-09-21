import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import type { Listing } from "@/lib/rummlee/types";
import { saleWindow, spotKindLabel } from "@/lib/rummlee/format";
import { FeeLine } from "./fee-line";
import { PriceTag } from "./price-tag";

export function ListingCard({ listing, premium = false }: { listing: Listing; premium?: boolean }) {
  const partner = listing.handoffSpotKind === "partner";
  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="group block overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-smooth)] hover:shadow-[var(--shadow-card-hover)] active:scale-[0.99]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-bg-warm sm:aspect-[4/3]">
        <img
          src={listing.photoUrl}
          alt=""
          className="size-full object-cover transition-transform duration-500 ease-[var(--ease-out-smooth)] group-hover:scale-[1.03]"
        />
        <span className="absolute left-2.5 top-2.5 rounded-md bg-surface/92 px-2 py-1 text-xs font-medium text-fg backdrop-blur-sm">
          {saleWindow(listing.saleStartsOn, listing.saleEndsOn)}
        </span>
        {listing.status === "sold" ? (
          <span className="absolute right-2.5 top-2.5 rounded-md bg-fg/85 px-2 py-1 text-xs font-medium text-primary-fg">
            Sold
          </span>
        ) : null}
        {partner ? (
          <span className="absolute bottom-2.5 left-2.5 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-fg">
            Partner store
          </span>
        ) : null}
      </div>
      <div className="space-y-1.5 p-3.5">
        <h3 className="font-display text-base font-semibold leading-snug tracking-[-0.02em] text-fg">
          {listing.title}
        </h3>
        <PriceTag cents={listing.priceCents} original={listing.originalCents} size="sm" />
        <FeeLine baseCents={listing.priceCents} premium={premium} className="text-xs" />
        <p className="flex items-center gap-1 text-xs text-muted">
          <MapPin className="size-3.5" strokeWidth={1.75} />
          {listing.handoffSpotName ?? listing.neighborhood}
        </p>
        <p className="text-xs text-subtle">
          {listing.handoffSpotKind ? spotKindLabel(listing.handoffSpotKind) : "Partner store"}
          {" · "}@{listing.sellerHandle}
        </p>
      </div>
    </Link>
  );
}
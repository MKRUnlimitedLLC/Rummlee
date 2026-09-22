import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { OutgoingOfferCard, SellerOfferCard } from "@/components/deal";
import { GuestGate, useAuthGate } from "@/components/guest-gate";
import { errMessage } from "@/lib/rummlee/errors";
import { money } from "@/lib/rummlee/format";
import { getInbox, respondOffer } from "@/lib/rummlee/server";

export const Route = createFileRoute("/inbox")({ component: InboxPage });

function InboxPage() {
  const { user, showGuest, showLoading } = useAuthGate();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["inbox"],
    queryFn: () => getInbox(),
    enabled: Boolean(user),
  });

  const respond = useMutation({
    mutationFn: (data: { offerId: string; action: "accept" | "decline" | "counter"; counterCents?: number }) =>
      respondOffer({ data }),
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: ["inbox"] });
      if (vars.action === "accept") toast.success("You said yes. Waiting for them to pay.");
      else if (vars.action === "counter") toast.success("Counteroffer sent. Waiting for them to pay.");
      else toast.success("Declined. The offer is over.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  if (showGuest) {
    return (
      <GuestGate
        title="Inbox"
        body="Offers, pickup holds, and neighbor notes show up here after you sign in."
      />
    );
  }
  if (showLoading || !user) return <div className="py-16 text-center text-muted">Loading…</div>;
  if (q.isPending) return <div className="py-16 text-center text-muted">Loading inbox…</div>;
  const data = q.data;
  if (!data) return null;

  const empty =
    data.offersIn.length + data.offersOut.length + data.orders.length + data.messages.length === 0;

  return (
    <main className="py-6">
      <h1 className="font-display text-3xl font-medium tracking-[-0.03em]">Inbox</h1>
      <p className="mt-1 text-muted">One offer. Yes, counteroffer, or decline. One decline ends it.</p>

      {empty ? (
        <p className="mt-8 rounded-2xl bg-surface px-4 py-10 text-center text-muted shadow-[var(--shadow-card)]">
          Quiet for now. Browse a sale and send an offer.
        </p>
      ) : null}

      {data.orders.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-display text-xl">Pickups</h2>
          <ul className="mt-3 space-y-3">
            {data.orders.map((o) => (
              <li key={o.id} className="flex gap-3 rounded-2xl bg-surface p-3 shadow-[var(--shadow-card)]">
                <img src={o.listingPhoto} alt={o.listingTitle} className="size-16 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{o.listingTitle}</p>
                  <p className="text-sm text-muted">
                    {money(o.amountCents)} · {o.status === "escrow" ? "your money is held until pickup" : "picked up"}
                  </p>
                  <Link to="/pickup/$id" params={{ id: o.id }} className="text-sm font-medium text-primary-ink">
                    {o.status === "escrow" ? "Open pickup code" : "View"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.offersIn.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-xl">Offers on your items</h2>
          <p className="mt-1 text-sm text-muted">Yes, counteroffer, or decline. One decline ends the offer.</p>
          <ul className="mt-3 space-y-3">
            {data.offersIn.map((o) => (
              <SellerOfferCard
                key={o.id}
                offer={o}
                busy={respond.isPending}
                onAccept={() => respond.mutate({ offerId: o.id, action: "accept" })}
                onPass={() => respond.mutate({ offerId: o.id, action: "decline" })}
                onCounter={(cents) => respond.mutate({ offerId: o.id, action: "counter", counterCents: cents })}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {data.offersOut.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-xl">Your offers</h2>
          <ul className="mt-3 space-y-3">
            {data.offersOut.map((o) => (
              <OutgoingOfferCard key={o.id} offer={o} />
            ))}
          </ul>
        </section>
      ) : null}

      {data.messages.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-xl">Notes</h2>
          <ul className="mt-3 space-y-2">
            {data.messages.slice(0, 12).map((m) => (
              <li key={m.id} className="rounded-xl bg-surface px-3 py-2 text-sm shadow-[var(--shadow-card)]">
                <Link to="/listings/$id" params={{ id: m.listingId }} className="font-medium">
                  {m.listingTitle}
                </Link>
                <p className="text-muted">
                  @{m.fromHandle}: {m.body}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

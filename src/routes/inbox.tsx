import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { OutgoingOfferCard, SellerOfferCard } from "@/components/deal";
import { GuestGate, useAuthGate } from "@/components/guest-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errMessage } from "@/lib/rummlee/errors";
import { money } from "@/lib/rummlee/format";
import { getInbox, respondOffer } from "@/lib/rummlee/server";
import { RateHandoff } from "@/components/trust";

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
    data.offersIn.length + data.offersOut.length + data.orders.length + data.messages.length + data.pendingRates.length + data.notices.length ===
    0;

  return (
    <main className="py-6">
      <h1 className="font-display text-3xl font-medium tracking-[-0.03em]">Inbox</h1>
      <p className="mt-1 text-muted">One offer. Yes, counteroffer, or decline. One decline ends it.</p>

      {data.offersIn.length === 0 ? <PracticeSeller /> : null}

      {data.notices.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-display text-xl">Updates</h2>
          <ul className="mt-3 space-y-3">
            {data.notices.map((n) => (
              <li key={n.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
                <p className="font-medium">{n.title}</p>
                <p className="mt-1 text-sm text-muted">{n.body}</p>
              </li>
            ))}
          </ul>
        </section>
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
                    {money(o.amountCents)} ·{" "}
                    {o.status === "cancelled"
                      ? "cancelled"
                      : o.status === "escrow"
                        ? o.checkedIn
                          ? "at the counter"
                          : "held until pickup"
                        : o.disputeStatus === "open"
                          ? "payout held"
                          : o.paidOutAt
                            ? "seller paid"
                            : "seller paid in 48 hours"}
                    {o.handoffType === "official"
                      ? " · Official store handoff"
                      : o.handoffType === "public"
                        ? " · Public place / lot"
                        : " · In person handoff"}
                  </p>
                  <Link to="/pickup/$id" params={{ id: o.id }} className="text-base font-medium text-primary-ink">
                    {o.status === "escrow" ? "Go pick up — code ready" : "View"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.pendingRates.length > 0 ? (
        <section className="mt-6 space-y-3">
          <h2 className="font-display text-xl">Rate a handoff</h2>
          <p className="text-sm text-muted">Thumbs up or down. Comment is private. They can challenge a thumbs down.</p>
          {data.pendingRates.map((p) => (
            <RateHandoff key={p.orderId} orderId={p.orderId} role={p.role} otherHandle={p.otherHandle} />
          ))}
        </section>
      ) : null}

      {data.offersIn.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-xl">Incoming — offers on your items</h2>
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
          <h2 className="font-display text-xl">Outgoing — offers you sent</h2>
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

function PracticeSeller() {
  const [counter, setCounter] = useState("");
  const [done, setDone] = useState<"yes" | "counter" | "decline" | null>(null);
  return (
    <section className="mt-6 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-xl">Practice — not a real offer</h2>
      <p className="mt-1 text-sm text-muted">
        One account can try the seller buttons here. Nothing is listed, held, or charged.
      </p>
      <p className="mt-3 font-medium">Sample lamp · asking $40 · offer $30</p>
      {done ? (
        <p className="mt-3 text-sm text-fg">
          {done === "yes"
            ? "You said yes. On a real offer they would pay the agreed price."
            : done === "counter"
              ? "Counteroffer sent. On a real offer, one decline from either of you would end it."
              : "Declined. A real offer would end. They could still pay asking."}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => { setDone("yes"); toast.success("Practice: you said yes."); }}>
              Yes
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => { setDone("decline"); toast.success("Practice: declined. The offer is over."); }}>
              Decline
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              inputMode="decimal"
              value={counter}
              onChange={(event) => setCounter(event.target.value)}
              placeholder="Counteroffer"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const amount = Number(counter);
                if (!Number.isFinite(amount) || amount <= 0) {
                  toast.error("Enter a counteroffer amount.");
                  return;
                }
                setDone("counter");
                toast.success(`Practice: counteroffer $${amount.toFixed(2)}.`);
              }}
            >
              Counteroffer
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

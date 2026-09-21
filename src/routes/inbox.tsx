import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { errMessage } from "@/lib/rummlee/errors";
import { money } from "@/lib/rummlee/format";
import { getInbox, respondOffer } from "@/lib/rummlee/server";

export const Route = createFileRoute("/inbox")({ component: InboxPage });

function InboxPage() {
  const { user, isPending } = useCurrentUserState();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["inbox"],
    queryFn: () => getInbox(),
    enabled: Boolean(user),
  });

  const respond = useMutation({
    mutationFn: (data: { offerId: string; action: "accept" | "decline" | "counter"; counterCents?: number }) =>
      respondOffer({ data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inbox"] });
      toast.success("Updated.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  if (isPending) return <div className="py-16 text-center text-muted">Loading…</div>;
  if (!user) return <RedirectToSignIn />;
  if (q.isPending) return <div className="py-16 text-center text-muted">Loading inbox…</div>;
  const data = q.data;
  if (!data) return null;

  const empty =
    data.offersIn.length + data.offersOut.length + data.orders.length + data.messages.length === 0;

  return (
    <main className="py-6">
      <h1 className="font-display text-3xl font-medium tracking-[-0.03em]">Inbox</h1>
      <p className="mt-1 text-muted">Offers, pickup holds, and neighbor notes.</p>

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
                <img src={o.listingPhoto} alt="" className="size-16 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{o.listingTitle}</p>
                  <p className="text-sm text-muted">
                    {money(o.amountCents)} · {o.status === "escrow" ? "held until scan" : "picked up"}
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
          <ul className="mt-3 space-y-3">
            {data.offersIn.map((o) => (
              <li key={o.id} className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-card)]">
                <div className="flex gap-3">
                  <img src={o.listingPhoto} alt="" className="size-16 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <p className="font-medium">{o.listingTitle}</p>
                    <p className="text-sm text-muted">
                      @{o.buyerHandle} offered {money(o.amountCents)} · {o.status}
                      {o.counterCents ? ` · counter ${money(o.counterCents)}` : ""}
                    </p>
                  </div>
                </div>
                {o.status === "pending" || o.status === "countered" ? (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => respond.mutate({ offerId: o.id, action: "accept" })}>
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const raw = window.prompt("Counter amount in dollars?");
                        const n = raw ? Math.round(Number(raw) * 100) : 0;
                        if (n >= 100) respond.mutate({ offerId: o.id, action: "counter", counterCents: n });
                      }}
                    >
                      Counter
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => respond.mutate({ offerId: o.id, action: "decline" })}>
                      Decline
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.offersOut.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-xl">Your offers</h2>
          <ul className="mt-3 space-y-3">
            {data.offersOut.map((o) => (
              <li key={o.id}>
                <Link
                  to="/listings/$id"
                  params={{ id: o.listingId }}
                  className="flex gap-3 rounded-2xl bg-surface p-3 shadow-[var(--shadow-card)]"
                >
                  <img src={o.listingPhoto} alt="" className="size-16 rounded-lg object-cover" />
                  <div>
                    <p className="font-medium">{o.listingTitle}</p>
                    <p className="text-sm text-muted">
                      {money(o.amountCents)} to @{o.sellerHandle} · {o.status}
                      {o.counterCents ? ` · they asked ${money(o.counterCents)}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
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

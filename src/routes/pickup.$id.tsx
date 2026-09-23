import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { errMessage } from "@/lib/rummlee/errors";
import { handoffLabel, money } from "@/lib/rummlee/format";
import { confirmPickup, getOrder } from "@/lib/rummlee/server";
import { cancelHold, reportProblem } from "@/lib/rummlee/books";
import { RateHandoff, VerifiedBadge } from "@/components/trust";
import { PartyCode } from "@/components/party-code";

export const Route = createFileRoute("/pickup/$id")({ component: PickupPage });

function PickupPage() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder({ data: id }),
    enabled: Boolean(user),
  });
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState("");

  const confirm = useMutation({
    mutationFn: () => confirmPickup({ data: { orderId: id, code: code || q.data?.pickupCode || "" } }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["order", id] });
      void qc.invalidateQueries({ queryKey: ["inbox"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success(
        res.done
          ? "Handoff recorded. The seller is paid in 48 hours if there’s no problem. Test credits, not real money."
          : "You’re marked. Waiting on the other person.",
      );
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: () => cancelHold({ data: { orderId: id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order", id] });
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Hold cancelled. Test credits are back with the buyer.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const report = useMutation({
    mutationFn: () => reportProblem({ data: { orderId: id, note: problem } }),
    onSuccess: () => {
      setProblem("");
      void qc.invalidateQueries({ queryKey: ["order", id] });
      toast.success("Problem reported. The seller is not paid until support decides.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  if (!user) return <RedirectToSignIn />;
  if (q.isPending) return <div className="py-16 text-center text-muted">Loading pickup…</div>;
  const order = q.data;
  if (!order) {
    return (
      <main className="py-16 text-center text-muted">
        Pickup not found.{" "}
        <Link to="/inbox" className="text-primary-ink">
          Inbox
        </Link>
      </main>
    );
  }

  const iAmBuyer = user.id === order.buyerId;
  const done = order.status === "picked_up";

  return (
    <main className="mx-auto max-w-md py-8 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-primary-ink">
        {done ? "Picked up" : "Held in escrow"}
      </p>
      <h1 className="mt-1 font-display text-3xl font-medium tracking-[-0.03em]">{order.listingTitle}</h1>
      <p className="mt-2 text-muted">
        Held {money(order.amountCents)} until you both confirm pickup · {handoffLabel(order.handoffType)}
        {order.handoffType === "person" && order.meetupNote ? ` · ${order.meetupNote}` : ""}
      </p>
      <p className="text-sm text-subtle">
        {iAmBuyer ? `Seller @${order.sellerHandle}` : `Buyer @${order.buyerHandle}`}
        <VerifiedBadge verified={order.otherVerified} className="ml-2" />
      </p>

      <div className="mx-auto mt-6 overflow-hidden rounded-[28px] bg-surface p-6 shadow-[var(--shadow-card)]">
        <img src={order.listingPhoto} alt={order.listingTitle} className="mx-auto mb-5 aspect-[4/3] w-full rounded-2xl object-cover" />
        {order.handoffType === "official" && order.myScan ? (
          <>
            <PartyCode value={order.myScan} />
            <p className="mt-4 text-sm text-muted">
              {iAmBuyer
                ? "Your buyer code. The counter scans it and shows a package number. Not your name."
                : "Your seller code. The counter scans it and assigns a package number. Not your name."}
            </p>
          </>
        ) : (
          <>
            <ScanFace code={order.pickupCode} />
            <p className="mt-4 font-mono text-3xl font-medium tracking-[0.28em] text-fg">{order.pickupCode}</p>
            <p className="mt-2 text-sm text-muted">Show this at the handoff. The other person has a different code.</p>
          </>
        )}
      </div>

      {done ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-success">
            {order.disputeStatus === "open"
              ? "You reported a problem. The seller is not paid until support decides."
              : order.disputeStatus === "refunded"
                ? "Support refunded this handoff. The seller was not paid."
                : order.paidOutAt
                  ? "The 48-hour window passed. The seller has been paid in test credits."
                  : "Handoff is done. The seller is paid 48 hours after this, unless the buyer reports a problem."}
          </p>
          {iAmBuyer && !order.paidOutAt && order.disputeStatus !== "open" && order.disputeStatus !== "refunded" ? (
            <form
              className="space-y-2 text-left"
              onSubmit={(e) => {
                e.preventDefault();
                report.mutate();
              }}
            >
              <Label htmlFor="problem">Report a problem</Label>
              <Input
                id="problem"
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="What was wrong with the item"
              />
              <Button type="submit" variant="secondary" className="w-full" disabled={report.isPending || problem.trim().length < 8}>
                Hold the payout
              </Button>
            </form>
          ) : null}
          {order.myRatingOverall ? (
            <p className="text-sm text-muted">
              You rated this handoff {order.myRatingOverall === "up" ? "thumbs up" : "thumbs down"}. Comment stays
              private.
            </p>
          ) : (
            <RateHandoff
              orderId={order.id}
              role={iAmBuyer ? "buyer" : "seller"}
              otherHandle={iAmBuyer ? order.sellerHandle : order.buyerHandle}
            />
          )}
        </div>
      ) : order.handoffType === "official" ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted">The store counter closes this when it scans the buyer code. You don’t confirm it yourself.</p>
          {!order.checkedIn ? (
            <Button variant="secondary" className="w-full" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel this hold
            </Button>
          ) : (
            <p className="text-sm text-muted">The counter has the package. A clerk can refuse it. You can’t cancel from here.</p>
          )}
        </div>
      ) : (
        <form
          className="mt-6 space-y-3 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            confirm.mutate();
          }}
        >
          <Label htmlFor="code">Confirm the scan</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={order.pickupCode}
            className="text-center font-mono tracking-[0.2em]"
          />
          <Button type="submit" className="w-full" disabled={confirm.isPending}>
            {confirm.isPending ? "Checking…" : iAmBuyer ? "I picked it up" : "I handed it over"}
          </Button>
          <p className="text-center text-xs text-subtle">
            Buyer confirmed: {order.buyerConfirmed ? "yes" : "not yet"} · Seller: {order.sellerConfirmed ? "yes" : "not yet"}
          </p>
          <Button type="button" variant="secondary" className="w-full" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
            Cancel this hold
          </Button>
        </form>
      )}
    </main>
  );
}

function ScanFace({ code }: { code: string }) {
  const bits = hashBits(code);
  return (
    <div className="mx-auto grid size-40 grid-cols-7 gap-1 rounded-2xl bg-fg p-3" aria-hidden>
      {bits.map((on, i) => (
        <span key={i} className={on ? "rounded-[2px] bg-primary-fg" : "rounded-[2px] bg-fg"} />
      ))}
    </div>
  );
}

function hashBits(code: string) {
  const out: boolean[] = [];
  let h = 2166136261;
  for (let i = 0; i < code.length; i += 1) h = Math.imul(h ^ code.charCodeAt(i), 16777619);
  for (let i = 0; i < 49; i += 1) {
    h = Math.imul(h ^ i, 16777619);
    const x = i % 7;
    const y = Math.floor(i / 7);
    const mirrored = y * 7 + Math.min(x, 6 - x);
    out.push(((h >>> (i % 24)) & 1) === 1 || x === 0 || y === 0 || x === 6 || y === 6 ? (x === 0 || y === 0 || x === 6 || y === 6 ? true : ((h >>> mirrored) & 1) === 1) : ((h >>> mirrored) & 1) === 1);
  }
  // finder-ish corners
  out[0] = true;
  out[6] = true;
  out[42] = true;
  return out;
}

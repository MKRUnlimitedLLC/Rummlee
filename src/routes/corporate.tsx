import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { errMessage } from "@/lib/rummlee/errors";
import { money } from "@/lib/rummlee/format";
import { decideAdmission, getCorporateDesk, submitAdmission, type CorporateMetrics } from "@/lib/rummlee/corporate";

export const Route = createFileRoute("/corporate")({
  component: CorporatePage,
});

function pct(bps: number) {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

function CorporatePage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["corporate"], queryFn: () => getCorporateDesk() });
  const [kind, setKind] = useState<"store" | "staff">("store");
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [note, setNote] = useState("");

  const apply = useMutation({
    mutationFn: () =>
      submitAdmission({ data: { kind, orgName, contactName, email, city, note: note || undefined } }),
    onSuccess: () => {
      toast.success("Application is in review.");
      setNote("");
      void qc.invalidateQueries({ queryKey: ["corporate"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const decide = useMutation({
    mutationFn: (data: { id: string; decision: "admit" | "deny" }) => decideAdmission({ data }),
    onSuccess: (res) => {
      toast.success(res.status === "admitted" ? "Admitted. The app can use them now." : "Denied.");
      void qc.invalidateQueries({ queryKey: ["corporate"] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const data = q.data;

  return (
    <main className="py-6">
      <p className="text-sm font-medium text-primary-ink">Corporate</p>
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">Admissions</h1>
      <p className="mt-1 max-w-xl text-muted">
        Stores and staff apply here. Operators admit them into the live app. Numbers are the last 30 days, in test
        credits until real billing is on.
      </p>

      {data?.isStaff && data.metrics ? <Metrics metrics={data.metrics} /> : null}

      {data?.isStaff ? (
        <section className="mt-8">
          <h2 className="font-display text-xl">Queue</h2>
          {data.queue.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No applications yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.queue.map((row) => (
                <li key={row.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
                  <p className="text-xs font-medium uppercase tracking-wider text-primary-ink">
                    {row.kind === "store" ? "Official store" : "Staff seat"} · {row.status}
                  </p>
                  <p className="mt-1 font-medium">
                    {row.orgName} · {row.city}
                  </p>
                  <p className="text-sm text-muted">
                    {row.contactName} · {row.email}
                  </p>
                  {row.note ? <p className="mt-2 text-sm text-fg">{row.note}</p> : null}
                  {row.status === "pending" ? (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, decision: "admit" })}>
                        Admit
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: row.id, decision: "deny" })}
                      >
                        Deny
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="mt-8 max-w-lg rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl">{data?.isStaff ? "File an application" : "Apply"}</h2>
        <p className="mt-1 text-sm text-muted">
          Official store: admitted locations show up as handoff spots. Staff: admitted handles can open this desk.
        </p>
        {!data?.signedIn ? (
          <Button asChild className="mt-4">
            <Link to="/login">Sign in to apply</Link>
          </Button>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              apply.mutate();
            }}
          >
            <div className="flex gap-2">
              {(["store", "staff"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={
                    kind === id
                      ? "rounded-full bg-fg px-3 py-1.5 text-sm font-medium text-primary-fg"
                      : "rounded-full bg-bg px-3 py-1.5 text-sm font-medium text-muted"
                  }
                  onClick={() => setKind(id)}
                >
                  {id === "store" ? "Official store" : "Staff seat"}
                </button>
              ))}
            </div>
            <div>
              <Label htmlFor="org">{kind === "store" ? "Store name" : "Team or role"}</Label>
              <Input id="org" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="contact">Your name</Label>
              <Input id="contact" value={contactName} onChange={(e) => setContactName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="city">City or neighborhood</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Naperville, Chicago" required />
            </div>
            <div>
              <Label htmlFor="note">Hours, lot, step-free</Label>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button type="submit" disabled={apply.isPending}>
              {apply.isPending ? "Sending…" : "Submit"}
            </Button>
          </form>
        )}
        {!data?.isStaff && data?.queue.length ? (
          <ul className="mt-4 space-y-2 text-sm">
            {data.queue.map((row) => (
              <li key={row.id}>
                {row.orgName} · {row.status}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}

function Metrics({ metrics }: { metrics: CorporateMetrics }) {
  const cards: { label: string; value: string; hint: string }[] = [
    { label: "GMV", value: money(metrics.gmvCents), hint: "Asking paid, last 30 days. Not cancelled." },
    { label: "Net revenue", value: money(metrics.netRevenueCents), hint: "Order fees plus Plus, sale days, and ID checks." },
    { label: "Take rate", value: pct(metrics.takeRateBps), hint: "Order fees ÷ GMV." },
    { label: "Orders", value: String(metrics.orders), hint: "Paid holds, last 30 days." },
    { label: "AOV", value: money(metrics.aovCents), hint: "GMV ÷ orders." },
    { label: "Cancel rate", value: pct(metrics.cancelRateBps), hint: "Cancelled ÷ all orders in the window." },
    { label: "Pickup rate", value: pct(metrics.pickupRateBps), hint: "Both confirmed ÷ paid orders." },
    { label: "Live listings", value: String(metrics.liveListings), hint: "On the app right now." },
    { label: "Sell-through", value: pct(metrics.sellThroughBps), hint: "Sold ÷ live + held + sold." },
    { label: "Active buyers", value: String(metrics.activeBuyers), hint: "Distinct buyers with a paid order." },
    { label: "Active sellers", value: String(metrics.activeSellers), hint: "Distinct sellers with a paid order." },
    { label: "Offer accept", value: pct(metrics.offerAcceptBps), hint: "Accepted ÷ decided offers." },
    { label: "Official store share", value: pct(metrics.officialShareBps), hint: "Paid orders at an official store." },
    { label: "Plus members", value: String(metrics.plusMembers), hint: "Profiles with Plus on." },
    { label: "Verified", value: String(metrics.verifiedProfiles), hint: "ID lock on a live account." },
    { label: "Waiting", value: String(metrics.pendingAdmissions), hint: "Applications not decided." },
  ];
  return (
    <section className="mt-6">
      <h2 className="font-display text-xl">Last 30 days</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{card.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em]">{card.value}</p>
            <p className="mt-1 text-sm text-muted">{card.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

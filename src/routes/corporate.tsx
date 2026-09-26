import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { errMessage } from "@/lib/rummlee/errors";
import { money } from "@/lib/rummlee/format";
import { decideAdmission, getCorporateDesk, getJobMap, submitAdmission, type CorporateMetrics } from "@/lib/rummlee/corporate";
import type { HouseDesk } from "@/lib/rummlee/house";
import { assignDesk, listPartnerSpots, pairCounter } from "@/lib/rummlee/desk";
import { attributeNeighbor, attributeStore, enrollReferrer, referralLedgerFile } from "@/lib/rummlee/referrals";
import { getOpenHolds, resolveHold } from "@/lib/rummlee/books";
import { decideResearcher, getResearcherQueue } from "@/lib/rummlee/research";
import { EXPENSE_CATEGORIES, expenseLabel, type ExpenseCategory } from "@/lib/rummlee/expenses-policy";
import { addCompanyExpense, exportCompanyExpenses, listCompanyExpenses, voidCompanyExpense } from "@/lib/rummlee/expenses";
import { exportLaunchList } from "@/lib/rummlee/launch-list";
import { StatementView } from "@/components/statement";
import { closeCase, getCustomerStatement, type Statement } from "@/lib/rummlee/records";

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
  const [lookup, setLookup] = useState("");
  const [customer, setCustomer] = useState<Statement | null>(null);

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

  const lookupMut = useMutation({
    mutationFn: () => getCustomerStatement({ data: { handle: lookup } }),
    onSuccess: (statement) => setCustomer(statement),
    onError: (e) => toast.error(errMessage(e)),
  });
  const close = useMutation({
    mutationFn: (id: string) => closeCase({ data: { id } }),
    onSuccess: () => {
      toast.success("Closed.");
      if (lookup) lookupMut.mutate();
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
      {data?.isStaff && data.house ? <HouseShelf house={data.house} /> : null}
      {data?.isStaff ? <Counters /> : null}
      {data?.isStaff ? <Holds /> : null}
      {data?.isStaff ? <JobMap /> : null}
      {data?.isStaff ? <ReferralLedger /> : null}
      {data?.isStaff ? <LaunchEmails /> : null}
      {data?.isStaff ? <CompanyExpenses /> : null}
      {data?.isStaff ? <ResearcherApps /> : null}

      {data?.isStaff ? (
        <section className="mt-8 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-xl">Customer</h2>
          <p className="mt-1 text-sm text-muted">Same year-to-date record they see, plus their support cases.</p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              lookupMut.mutate();
            }}
          >
            <Input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="@handle" aria-label="Handle" />
            <Button type="submit" disabled={lookupMut.isPending}>
              Look up
            </Button>
          </form>
          {customer ? (
            <div className="mt-4">
              <StatementView statement={customer} staff />
              {customer.cases.length ? (
                <ul className="mt-4 space-y-2">
                  {customer.cases.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-bg px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">
                          {item.subject} · {item.status}
                        </p>
                        <p className="text-muted">{item.body}</p>
                      </div>
                      {item.status === "open" ? (
                        <Button size="sm" variant="secondary" disabled={close.isPending} onClick={() => close.mutate(item.id)}>
                          Close
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">No support cases.</p>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

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

function ResearcherApps() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["researcher-apps"], queryFn: () => getResearcherQueue() });
  const decide = useMutation({
    mutationFn: (data: { profileId: string; approve: boolean }) => decideResearcher({ data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["researcher-apps"] });
      toast.success("Saved.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const apps = q.data?.apps ?? [];
  return (
    <section className="mt-8 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-xl">Researcher applications</h2>
      <p className="mt-1 text-sm text-muted">
        1099 contractors. The legal name is for the form, not for listings. Approving turns on their account. Pay stays
        on the researcher payout row.
      </p>
      {apps.length === 0 ? <p className="mt-3 text-sm text-muted">None waiting.</p> : null}
      <ul className="mt-3 space-y-3">
        {apps.map((row) => (
          <li key={row.profileId} className="rounded-2xl bg-bg px-3 py-3 text-sm">
            <p className="font-medium">@{row.handle} · {row.legalName}</p>
            <p className="text-muted">{row.city}</p>
            <p className="mt-1">{row.skills}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ profileId: row.profileId, approve: true })}>
                Approve
              </Button>
              <Button size="sm" variant="secondary" disabled={decide.isPending} onClick={() => decide.mutate({ profileId: row.profileId, approve: false })}>
                Deny
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function JobMap() {
  const q = useQuery({ queryKey: ["job-map"], queryFn: () => getJobMap() });
  const jobs = q.data;
  const rows = [
    {
      name: "Market lead",
      count: jobs ? String(jobs.leads) : "…",
      pay: "5% of the fees Rummlee kept on neighbors they signed. Store bonuses at 50 and 500 handoffs. Not on the public site.",
    },
    {
      name: "Ambassador",
      count: jobs ? String(jobs.ambassadors) : "…",
      pay: "$25 once, when someone they signed has put $25 of kept fees into Rummlee. Not on the public site.",
    },
    {
      name: "Researcher",
      count: jobs ? `${jobs.researchers} active · ${jobs.pendingResearchers} waiting` : "…",
      pay: "$4.60 when a seller accepts a write-up. $2.50 if the sale lands in the top half of their range. $2.50 more if it sells at full asking. One item at a time, 15 minutes, one hold. Paid from the research ledger, not the referral file.",
    },
  ];
  return (
    <section className="mt-8 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-xl">Job map</h2>
      <p className="mt-1 text-sm text-muted">
        Contractor jobs. Market leads, ambassadors, and researchers are all 1099-NEC. None are employees. No W-2. Research asks open now: {jobs ? jobs.openAsks : "…"}. Someone is on the clock: {jobs ? jobs.claimed : "…"}.
      </p>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.name} className="rounded-2xl bg-bg px-4 py-3">
            <p className="font-medium">{row.name}</p>
            <p className="text-sm text-muted">{row.count}</p>
            <p className="mt-1 text-sm">{row.pay}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReferralLedger() {
  const qc = useQueryClient();
  const file = useMutation({
    mutationFn: () => referralLedgerFile(),
    onSuccess: (res) => {
      const blob = new Blob([res.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.filename;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<"market_lead" | "ambassador">("market_lead");
  const [city, setCity] = useState("");
  const [neighbor, setNeighbor] = useState("");
  const [referrer, setReferrer] = useState("");
  const [spotId, setSpotId] = useState("");
  const [storeReferrer, setStoreReferrer] = useState("");
  const enroll = useMutation({
    mutationFn: () => enrollReferrer({ data: { handle, role, city: city || undefined, acceptingSignups: true } }),
    onSuccess: () => {
      toast.success("Referrer saved.");
      setHandle("");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const tagNeighbor = useMutation({
    mutationFn: () => attributeNeighbor({ data: { neighbor, referrer } }),
    onSuccess: () => {
      toast.success("Neighbor tagged.");
      setNeighbor("");
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const tagStore = useMutation({
    mutationFn: () => attributeStore({ data: { spotId, referrer: storeReferrer } }),
    onSuccess: () => {
      toast.success("Store tagged.");
      setSpotId("");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  return (
    <section className="mt-8 max-w-lg rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-xl">Referral ledger</h2>
      <p className="mt-1 text-sm text-muted">
        Amounts stay off this page. Tag who signed whom, then download the file for the books. Test rows are not a payable.
      </p>
      <form
        className="mt-4 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          enroll.mutate();
        }}
      >
        <p className="text-sm font-medium">Referrer</p>
        <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Handle" />
        <div className="flex gap-2">
          {(["market_lead", "ambassador"] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={
                role === id
                  ? "rounded-full bg-fg px-3 py-1.5 text-sm font-medium text-primary-fg"
                  : "rounded-full bg-bg px-3 py-1.5 text-sm font-medium text-muted"
              }
              onClick={() => setRole(id)}
            >
              {id === "market_lead" ? "Market lead" : "Ambassador"}
            </button>
          ))}
        </div>
        <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City, if a lead" />
        <Button size="sm" type="submit" disabled={enroll.isPending || handle.trim().length < 2}>
          Save referrer
        </Button>
      </form>
      <form
        className="mt-5 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          tagNeighbor.mutate();
        }}
      >
        <p className="text-sm font-medium">Neighbor they signed</p>
        <Input value={neighbor} onChange={(e) => setNeighbor(e.target.value)} placeholder="Neighbor handle" />
        <Input value={referrer} onChange={(e) => setReferrer(e.target.value)} placeholder="Referrer handle" />
        <Button size="sm" type="submit" disabled={tagNeighbor.isPending}>
          Tag neighbor
        </Button>
      </form>
      <form
        className="mt-5 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          tagStore.mutate();
        }}
      >
        <p className="text-sm font-medium">Official store a lead signed</p>
        <Input value={spotId} onChange={(e) => setSpotId(e.target.value)} placeholder="Store id" />
        <Input value={storeReferrer} onChange={(e) => setStoreReferrer(e.target.value)} placeholder="Lead handle" />
        <Button size="sm" type="submit" disabled={tagStore.isPending}>
          Tag store
        </Button>
      </form>
      <Button className="mt-5" size="sm" variant="secondary" disabled={file.isPending} onClick={() => file.mutate()}>
        {file.isPending ? "Preparing…" : "Download ledger file"}
      </Button>
    </section>
  );
}

function Counters() {
  const spots = useQuery({ queryKey: ["partner-spots"], queryFn: () => listPartnerSpots() });
  const [spotId, setSpotId] = useState("");
  const [label, setLabel] = useState("Front counter");
  const [handle, setHandle] = useState("");
  const [secret, setSecret] = useState("");
  const pair = useMutation({
    mutationFn: () => pairCounter({ data: { spotId, label } }),
    onSuccess: (res) => {
      setSecret(res.secret);
      toast.success(`Paired ${res.spotName}. Copy the code onto that device once.`);
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const assign = useMutation({
    mutationFn: () => assignDesk({ data: { handle, spotId } }),
    onSuccess: () => toast.success("That handle can open the counter."),
    onError: (e) => toast.error(errMessage(e)),
  });
  return (
    <section className="mt-8 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-xl">Store counters</h2>
      <p className="mt-1 text-sm text-muted">
        A counter only scans. Seller code checks a package in and prints a number. Buyer code shows that number. The
        device fee is on Fees — $0 until you set a hardware price.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Official store
          <select
            className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2"
            value={spotId}
            onChange={(e) => setSpotId(e.target.value)}
          >
            <option value="">Choose</option>
            {(spots.data ?? []).map((spot) => (
              <option key={spot.id} value={spot.id}>
                {spot.name} · {spot.area}
              </option>
            ))}
          </select>
        </label>
        <div>
          <Label htmlFor="counter-label">Device name</Label>
          <Input id="counter-label" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={!spotId || pair.isPending} onClick={() => pair.mutate()}>
          Pair a device
        </Button>
      </div>
      {secret ? (
        <p className="mt-3 break-all rounded-xl bg-bg px-3 py-3 font-mono text-sm">
          {secret}
          <span className="mt-1 block font-sans text-muted">Shown once. Enter it at /desk on that screen.</span>
        </p>
      ) : null}
      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          assign.mutate();
        }}
      >
        <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle for this store" className="max-w-xs" />
        <Button type="submit" variant="secondary" disabled={!spotId || assign.isPending}>
          Give them counter login
        </Button>
      </form>
    </section>
  );
}

function Holds() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["holds"], queryFn: () => getOpenHolds() });
  const decide = useMutation({
    mutationFn: (data: { orderId: string; action: "refund" | "pay" }) => resolveHold({ data }),
    onSuccess: () => {
      toast.success("Saved.");
      void qc.invalidateQueries({ queryKey: ["holds"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const rows = q.data ?? [];
  return (
    <section className="mt-8 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-xl">Payouts waiting</h2>
      <p className="mt-1 text-sm text-muted">
        Seller is paid 48 hours after handoff. A reported problem stays here until you refund the buyer or pay the seller.
      </p>
      {rows.length === 0 ? <p className="mt-3 text-sm text-muted">None waiting.</p> : null}
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl bg-bg px-3 py-3 text-sm">
            <p className="font-medium">{row.title}</p>
            <p className="text-muted">
              {row.dispute_status === "open" ? "Problem reported" : "Window open"}
              {row.payout_cents != null ? ` · seller would get ${money(Number(row.payout_cents))}` : ""}
              {row.dispute_note ? ` · ${row.dispute_note}` : ""}
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ orderId: row.id, action: "pay" })}>
                Pay seller
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ orderId: row.id, action: "refund" })}
              >
                Refund buyer
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HouseShelf({ house }: { house: HouseDesk }) {
  return (
    <section className="mt-8 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-xl">Rummlee shelf · {house.market}</h2>
      <p className="mt-1 text-sm text-muted">
        Packages a seller left. No names on this list. Charity set-aside is a liability, not revenue.{" "}
        {money(house.charityCents)} set aside so far. Test credits until real billing is on.
      </p>
      <p className="mt-2 text-sm">
        <Link to="/sales/$id" params={{ id: house.saleId }} className="font-medium text-primary-ink">
          Open the public shelf
        </Link>
      </p>
      {house.waiting.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium">Waiting on a choice</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {house.waiting.map((row) => (
              <li key={`${row.title}-${row.packageNo}`}>
                Tag {row.packageNo} · {row.title}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">No seller is waiting to choose.</p>
      )}
      {house.shelf.length ? (
        <ul className="mt-4 space-y-1 text-sm">
          {house.shelf.map((row) => (
            <li key={`${row.title}-${row.packageNo}`}>
              Tag {row.packageNo} · {row.title} · {money(row.priceCents)} · {row.status === "held" ? "held" : "on the shelf"}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">Nothing on the shelf yet.</p>
      )}
    </section>
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

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function LaunchEmails() {
  const launch = useMutation({
    mutationFn: () => exportLaunchList(),
    onSuccess: (res) => downloadBlob(res.filename, new Blob([res.csv], { type: "text/csv" })),
    onError: (error) => toast.error(errMessage(error)),
  });
  return (
    <section className="mt-8 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-xl">Launch emails</h2>
      <p className="mt-1 text-sm text-muted">Staff-only CSV of addresses that asked to be told when real listings open.</p>
      <div className="mt-3">
        <Button type="button" size="sm" disabled={launch.isPending} onClick={() => launch.mutate()}>
          Launch emails
        </Button>
      </div>
    </section>
  );
}

function CompanyExpenses() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["company-expenses"], queryFn: () => listCompanyExpenses() });
  const [spentOn, setSpentOn] = useState("2026-09-25");
  const [payee, setPayee] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("hosting");
  const [dollars, setDollars] = useState("");
  const [purpose, setPurpose] = useState("");
  const [paidBy, setPaidBy] = useState<"company" | "founder">("company");
  const [hasReceipt, setHasReceipt] = useState(true);
  const add = useMutation({
    mutationFn: () => {
      const amountCents = Math.round(Number(dollars) * 100);
      return addCompanyExpense({
        data: { spentOn, payee, category, amountCents, businessPurpose: purpose, paidBy, hasReceipt },
      });
    },
    onSuccess: (res) => {
      toast.success(res.deductibleCents > 0 ? "Saved. The deductible amount is on the row." : "Saved. Not a current deduction.");
      setPayee("");
      setDollars("");
      setPurpose("");
      void qc.invalidateQueries({ queryKey: ["company-expenses"] });
    },
    onError: (error) => toast.error(errMessage(error)),
  });
  const drop = useMutation({
    mutationFn: (id: string) => voidCompanyExpense({ data: { id } }),
    onSuccess: () => {
      toast.success("Voided. It stays in the file.");
      void qc.invalidateQueries({ queryKey: ["company-expenses"] });
    },
    onError: (error) => toast.error(errMessage(error)),
  });
  const file = useMutation({
    mutationFn: (mode: "live" | "beta") => exportCompanyExpenses({ data: { mode } }),
    onSuccess: (res) => downloadBlob(res.filename, new Blob([res.csv], { type: "text/csv" })),
    onError: (error) => toast.error(errMessage(error)),
  });
  return (
    <section className="mt-8 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-xl">Company costs</h2>
      <p className="mt-1 text-sm text-muted">
        A receipt and a business purpose, or it is not a deduction. Meals are half. Entertainment, fines, and personal costs are never a deduction. This desk does not change a customer fee.
      </p>
      <form
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="exp-date">Date</Label>
            <Input id="exp-date" type="date" value={spentOn} onChange={(event) => setSpentOn(event.target.value)} required />
          </div>
          <div>
            <Label htmlFor="exp-payee">Payee</Label>
            <Input id="exp-payee" value={payee} onChange={(event) => setPayee(event.target.value)} required />
          </div>
          <div>
            <Label htmlFor="exp-cat">Kind</Label>
            <select
              id="exp-cat"
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={category}
              onChange={(event) => setCategory(event.target.value as ExpenseCategory)}
            >
              {EXPENSE_CATEGORIES.map((id) => (
                <option key={id} value={id}>
                  {expenseLabel(id)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="exp-amt">Amount</Label>
            <Input id="exp-amt" inputMode="decimal" value={dollars} onChange={(event) => setDollars(event.target.value)} placeholder="0.00" required />
          </div>
        </div>
        <div>
          <Label htmlFor="exp-why">Business purpose</Label>
          <Textarea id="exp-why" value={purpose} onChange={(event) => setPurpose(event.target.value)} required />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="paid-by" checked={paidBy === "company"} onChange={() => setPaidBy("company")} />
            Company paid
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="paid-by" checked={paidBy === "founder"} onChange={() => setPaidBy("founder")} />
            Founder paid, reimburse
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={hasReceipt} onChange={(event) => setHasReceipt(event.target.checked)} />
            Receipt is on file
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={add.isPending}>
            Save cost
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={file.isPending} onClick={() => file.mutate("live")}>
            Live costs
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={file.isPending} onClick={() => file.mutate("beta")}>
            Beta file, not for the books
          </Button>
        </div>
      </form>
      <ul className="mt-4 grid gap-2">
        {(q.data ?? []).map((row) => (
          <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 rounded-2xl border border-border px-3 py-2 text-sm">
            <div>
              <div className={row.voided ? "text-muted line-through" : ""}>
                {row.spentOn} · {row.payee} · {money(row.amountCents)}
              </div>
              <div className="text-muted">
                {row.label}
                {row.voided ? " · voided" : ` · deductible now ${money(row.deductibleCents)}`}
                {row.testMode ? " · test mode" : ""}
              </div>
            </div>
            {row.voided ? null : (
              <Button type="button" size="sm" variant="secondary" disabled={drop.isPending} onClick={() => drop.mutate(row.id)}>
                Void
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

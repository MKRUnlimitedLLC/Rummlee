import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { LegalPage } from "@/components/legal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { errMessage, isUnauthorized } from "@/lib/rummlee/errors";
import { feeById, formatFeeValue, sellerFeeCents, type FeeRow } from "@/lib/rummlee/fees";
import { claimOperator, getFeeTable, saveFee } from "@/lib/rummlee/server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fees")({
  loader: () => getFeeTable(),
  component: FeesPage,
});

function FeesPage() {
  const initial = Route.useLoaderData();
  const { user } = useCurrentUserState();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["fees"],
    queryFn: () => getFeeTable(),
    initialData: initial,
  });
  const claim = useMutation({
    mutationFn: () => claimOperator(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fees"] });
      toast.success("This account can adjust the fee table.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const fees = q.data?.fees ?? [];
  const isStaff = Boolean(q.data?.isStaff);
  const canClaim = Boolean(user && q.data?.canClaim);

  return (
    <LegalPage
      title="Fees"
      lede="Beta. Buyer fee is 5%, or $0 with Plus and +++. The seller pays $2.99 or a tier percent, whichever is more. That fee is the same for an official store, a public place, or in person. Plus is 5 free sale days a month. +++ sale days are free. Feature one item or a whole sale until it ends. If test credits don’t cover a sale day or a feature, the rest comes out of the next payout. Sales tax is always listed on its own. Paid in test credits. No card is charged."
    >
      <TierCards fees={fees} />
      <div className="overflow-x-auto rounded-[24px] bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted">
              <th className="px-4 py-3">Fee</th>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {fees.map((row) => (
              <tr key={row.id} className="border-b border-border/70 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-fg">{row.label}</p>
                  <p className="mt-0.5 text-muted">{row.description}</p>
                </td>
                <td className="px-4 py-3 capitalize text-muted">{row.chargedTo === "none" ? "—" : row.chargedTo}</td>
                <td className="px-4 py-3 capitalize text-muted">{whenLabel(row.chargedWhen)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-fg">{formatFeeValue(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-muted">
        Checkout is the only other place a fee appears — on the listing, when you pay.{" "}
        <Link to="/" className="font-medium text-primary-ink">
          Back to browse
        </Link>
      </p>

      {canClaim ? (
        <div className="mt-8 rounded-2xl bg-primary-soft p-4">
          <p className="font-medium">Operator tools</p>
          <p className="mt-1 text-sm text-muted">No operator is set yet. Claim this account to adjust each fee on its own.</p>
          <Button className="mt-3" size="sm" onClick={() => claim.mutate()} disabled={claim.isPending}>
            {claim.isPending ? "Saving…" : "This is the operator account"}
          </Button>
        </div>
      ) : null}

      {isStaff ? <FeeEditor rows={fees} /> : null}
    </LegalPage>
  );
}

function TierCards({ fees }: { fees: FeeRow[] }) {
  const month = (id: string) => formatFeeValue(feeById(fees, id) ?? { id, label: "", description: "", unit: "cents", percentBps: 0, amountCents: 0, chargedTo: "none", chargedWhen: "never", sort: 0, enabled: true });
  const seller = (tier: "plus" | "trio" | null) => {
    const floor = feeById(fees, "seller_floor");
    const rate = feeById(fees, tier === "trio" ? "seller_trio" : tier === "plus" ? "seller_plus" : "seller_payout");
    const sample = sellerFeeCents(fees, 4200, tier);
    return `${floor ? formatFeeValue(floor) : "$2.99"} or ${rate ? formatFeeValue(rate) : "—"}, whichever is more. On a $42 item that is ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(sample / 100)}.`;
  };
  const tiers = [
    { name: "Standard", price: "$0", buyer: "5%", seller: seller(null), days: "$2.99 a day", extra: "ID check $4.99. Researcher $7.99. Photo fill $0.99. Feature an item $1.99 or a sale $4.99." },
    { name: "Plus", price: `${month("premium_switch")} / month · ${month("plus_year")} / year`, buyer: "$0", seller: seller("plus"), days: "5 free a month, then $2.99", extra: "ID check included. Alerts for new items and in-person sales. Researcher $7.99. Photo fill $0.99. Feature an item $1.99 or a sale $4.99. Normal item cap." },
    { name: "+++", price: `${month("trio_month")} / month · ${month("trio_year")} / year`, buyer: "$0", seller: seller("trio"), days: "Unlimited", extra: "No item cap. Plus alerts included. Early look at items before a sale starts, with no price until it’s on. After a sale ends, one overtime offer if the seller sets a get-rid-of-it price. 5 researches a month, then $7.99. Reveal 5 times a month. ID check included. Feature an item $1.99 or a sale $4.99." },
  ];
  return (
    <div className="mb-6 grid gap-3">
      {tiers.map((tier) => (
        <section key={tier.name} className="rounded-[24px] bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl">{tier.name}</h2>
            <p className="text-sm font-medium text-fg">{tier.price}</p>
          </div>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted">Buyer fee</dt><dd>{tier.buyer}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Seller fee</dt><dd className="text-right">{tier.seller}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Sale days</dt><dd className="text-right">{tier.days}</dd></div>
          </dl>
          <p className="mt-2 text-sm text-muted">{tier.extra}</p>
        </section>
      ))}
    </div>
  );
}

function whenLabel(when: string) {
  if (when === "checkout") return "Checkout";
  if (when === "listing") return "When you list";
  if (when === "upgrade") return "Rummlee Plus";
  return "Never";
}

function FeeEditor({ rows }: { rows: FeeRow[] }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (data: { id: string; percentBps?: number; amountCents?: number; enabled?: boolean }) => saveFee({ data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fees"] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
      toast.success("Fee table updated.");
    },
    onError: (e) => {
      if (isUnauthorized(e)) toast.error("Sign in as the operator.");
      else toast.error(errMessage(e));
    },
  });

  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-medium tracking-[-0.02em]">Adjust independently</h2>
      <p className="mt-1 text-sm text-muted">Each row saves on its own. This is the live table neighbors see.</p>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <FeeRowEditor key={row.id} row={row} saving={save.isPending} onSave={(patch) => save.mutate({ id: row.id, ...patch })} />
        ))}
      </ul>
    </section>
  );
}

function FeeRowEditor({
  row,
  saving,
  onSave,
}: {
  row: FeeRow;
  saving: boolean;
  onSave: (patch: { percentBps?: number; amountCents?: number; enabled?: boolean }) => void;
}) {
  const [pct, setPct] = useState(String(row.percentBps / 100));
  const [dollars, setDollars] = useState(String(row.amountCents / 100));
  return (
    <li className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{row.label}</p>
          <p className="text-sm text-muted">{row.description}</p>
        </div>
        <button
          type="button"
          className={cn("text-sm font-medium", row.enabled ? "text-primary-ink" : "text-muted")}
          onClick={() => onSave({ enabled: !row.enabled })}
        >
          {row.enabled ? "On" : "Off"}
        </button>
      </div>
      {row.unit === "percent" ? (
        <div className="mt-3 flex items-center gap-2">
          <Input
            inputMode="decimal"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            aria-label={`${row.label} percent`}
            className="max-w-28"
          />
          <span className="text-sm text-muted">%</span>
          <Button
            size="sm"
            variant="secondary"
            disabled={saving}
            onClick={() => {
              const n = Number(pct);
              if (!Number.isFinite(n) || n < 0) return toast.error("Use a percent 0 or more.");
              onSave({ percentBps: Math.round(n * 100) });
            }}
          >
            Save
          </Button>
        </div>
      ) : null}
      {row.unit === "cents" ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-muted">$</span>
          <Input
            inputMode="decimal"
            value={dollars}
            onChange={(e) => setDollars(e.target.value)}
            aria-label={`${row.label} dollars`}
            className="max-w-28"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={saving}
            onClick={() => {
              const n = Number(dollars);
              if (!Number.isFinite(n) || n < 0) return toast.error("Use a dollar amount 0 or more.");
              onSave({ amountCents: Math.round(n * 100) });
            }}
          >
            Save
          </Button>
        </div>
      ) : null}
    </li>
  );
}

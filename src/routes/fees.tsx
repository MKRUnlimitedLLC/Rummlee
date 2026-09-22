import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { LegalPage } from "@/components/legal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { errMessage, isUnauthorized } from "@/lib/rummlee/errors";
import { formatFeeValue, type FeeRow } from "@/lib/rummlee/fees";
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
      lede="Beta. Every Rummlee fee, in one table. Buyer fee is 5%, or 0% with Rummlee Plus. Official store is $2.99 each side unless that person has Plus ($9.99/month or $99.99/year) — then their side is waived. Checkout still runs this table in test credits. No card is charged."
    >
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

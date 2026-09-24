import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { errMessage } from "@/lib/rummlee/errors";
import { decideFact, FACT_FIELDS, fileFact, getListingFacts, type FactField } from "@/lib/rummlee/rep";

export function ListingFacts({
  listingId,
  mine,
  signedIn,
}: {
  listingId: string;
  mine: boolean;
  signedIn: boolean;
}) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["facts", listingId], queryFn: () => getListingFacts({ data: listingId }) });
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<FactField>("brand");
  const [value, setValue] = useState("");
  const facts = q.data?.facts ?? [];
  const approved = facts.filter((fact) => fact.status === "approved");
  const pending = facts.filter((fact) => fact.status !== "approved");

  const file = useMutation({
    mutationFn: () => fileFact({ data: { listingId, field, value } }),
    onSuccess: () => {
      setValue("");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["facts", listingId] });
      toast.success("Sent to the seller. It shows only if they approve it.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const decide = useMutation({
    mutationFn: (data: { factId: string; approve: boolean }) => decideFact({ data }),
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: ["facts", listingId] });
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["my-rep"] });
      toast.success(vars.approve ? "Added to the listing." : "Declined. It stays off the listing.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <section className="mt-5 space-y-3 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-xl font-semibold">Filled in by neighbors</h2>
      <p className="text-sm text-muted">
        A blank the seller left. Brand, size, material, era, a flaw, or what’s included. It stays off the listing until
        the seller approves it. Approve is +2 Rep for the neighbor. Decline is −2. Not a payout.
      </p>
      {approved.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {approved.map((fact) => (
            <div key={fact.id} className="contents">
              <dt className="text-muted">{fact.label}</dt>
              <dd>
                {fact.value}
                {fact.handle ? <span className="text-muted"> · @{fact.handle}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted">Nothing approved yet.</p>
      )}
      {pending.map((fact) => (
        <article key={fact.id} className="rounded-2xl bg-bg px-3 py-3 text-sm">
          <p className="font-medium">
            {fact.status === "declined" ? "Declined" : "Waiting on the seller"} · {fact.label}
          </p>
          <p className="mt-1">{fact.value}</p>
          {fact.canDecide ? (
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ factId: fact.id, approve: true })}>
                Approve
              </Button>
              <Button size="sm" variant="secondary" disabled={decide.isPending} onClick={() => decide.mutate({ factId: fact.id, approve: false })}>
                Decline
              </Button>
            </div>
          ) : null}
        </article>
      ))}
      {!mine && signedIn ? (
        open ? (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              file.mutate();
            }}
          >
            <Label htmlFor="fact-field">Blank to fill</Label>
            <select
              id="fact-field"
              className="w-full rounded-xl bg-bg px-3 py-2 text-sm"
              value={field}
              onChange={(event) => setField(event.target.value as FactField)}
            >
              {FACT_FIELDS.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </select>
            <Input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Wool, size 8, a chip on the rim" maxLength={80} />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={file.isPending || value.trim().length < 2}>
                Send to seller
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button type="button" className="text-sm font-medium text-primary-ink" onClick={() => setOpen(true)}>
            Fill a blank
          </button>
        )
      ) : null}
    </section>
  );
}

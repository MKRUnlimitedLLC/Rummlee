import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { UserButton, RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { ListingCard } from "@/components/listing-card";
import { LegalLinks } from "@/components/legal";
import { NEIGHBORHOODS } from "@/lib/rummlee/constants";
import { errMessage } from "@/lib/rummlee/errors";
import { money, saleWindow } from "@/lib/rummlee/format";
import { getMe, togglePremium, topUpWallet, updateProfile, deleteMyAccount } from "@/lib/rummlee/server";

export const Route = createFileRoute("/you")({ component: YouPage });

function YouPage() {
  const { user, isPending } = useCurrentUserState();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["me"],
    queryFn: () => getMe(),
    enabled: Boolean(user),
  });

  const topUp = useMutation({
    mutationFn: (cents: number) => topUpWallet({ data: cents }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Wallet topped up.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const premium = useMutation({
    mutationFn: () => togglePremium(),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success(res.isPremium ? "Premium on — 5% fees." : "Premium off.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const saveProf = useMutation({
    mutationFn: (neighborhood: string) => updateProfile({ data: { neighborhood } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Neighborhood saved.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const removeAccount = useMutation({
    mutationFn: () => deleteMyAccount(),
    onSuccess: async () => {
      toast.success("Account deleted.");
      await signOut().catch(() => undefined);
      window.location.assign("/");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  if (isPending) return <div className="py-16 text-center text-muted">Loading…</div>;
  if (!user) return <RedirectToSignIn />;
  const me = q.data?.me;

  return (
    <main className="py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Your handle</p>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">@{me?.handle ?? "…"}</h1>
          <p className="mt-1 text-sm text-subtle">Neighbors see this. Your real name stays yours.</p>
        </div>
        <UserButton />
      </div>

      <section className="mt-6 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
        <p className="text-sm text-muted">Wallet</p>
        <p className="font-display text-4xl font-medium tabular-nums tracking-[-0.03em]">{me ? money(me.walletCents) : "—"}</p>
        <p className="mt-1 text-sm text-subtle">Pay is held here until both of you confirm pickup.</p>
        <div className="mt-4 flex gap-2">
          {[2000, 5000, 10000].map((c) => (
            <Button key={c} variant="secondary" size="sm" onClick={() => topUp.mutate(c)} disabled={topUp.isPending}>
              Add {money(c)}
            </Button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-bg px-3 py-3">
          <div>
            <p className="font-medium">Rummlee Premium</p>
            <p className="text-sm text-muted">{me?.isPremium ? "5% fees on" : "10% fees · $4 to switch"}</p>
          </div>
          <Button size="sm" variant={me?.isPremium ? "secondary" : "primary"} onClick={() => premium.mutate()} disabled={premium.isPending}>
            {me?.isPremium ? "Turn off" : "Upgrade"}
          </Button>
        </div>
      </section>

      <section className="mt-6 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
        <Label htmlFor="hood">Your neighborhood</Label>
        <select
          id="hood"
          className="h-11 w-full rounded-lg bg-bg px-3 text-[15px] shadow-[0_0_0_1px_rgba(28,25,21,0.1)]"
          value={me?.neighborhood ?? ""}
          onChange={(e) => saveProf.mutate(e.target.value)}
        >
          <option value="">Choose one</option>
          {NEIGHBORHOODS.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl">Your sales</h2>
        {q.data?.sales.length ? (
          <ul className="mt-3 space-y-2">
            {q.data.sales.map((s) => (
              <li key={s.id}>
                <Link to="/sales/$id" params={{ id: s.id }} className="block rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted">
                    {saleWindow(s.startsOn, s.endsOn)} · {s.itemCount} items
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">
            None yet. <Link to="/sell" className="font-medium text-primary-ink">List a sale</Link>
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl">Saved</h2>
        {q.data?.saved.length ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {q.data.saved.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Tap the bookmark on a listing to keep it here.</p>
        )}
      </section>

      {q.data?.txs.length ? (
        <section className="mt-8">
          <h2 className="font-display text-xl">Wallet activity</h2>
          <ul className="mt-3 space-y-2">
            {q.data.txs.map((t) => (
              <li key={t.id} className="flex justify-between rounded-xl bg-surface px-3 py-2 text-sm">
                <span className="text-muted">{t.note ?? t.kind}</span>
                <span className="tabular-nums font-medium">{money(t.amountCents)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <How />

      <section className="mt-10 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl">Account</h2>
        <p className="mt-2 text-sm text-muted">
          Delete removes your handle, listings, messages, and wallet. This cannot be undone.
        </p>
        {confirmDelete ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={removeAccount.isPending}
              onClick={() => removeAccount.mutate()}
            >
              {removeAccount.isPending ? "Deleting…" : "Yes, delete forever"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
              Keep account
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="mt-4 text-danger" onClick={() => setConfirmDelete(true)}>
            Delete account
          </Button>
        )}
      </section>

      <LegalLinks className="mt-8 pb-4" />
    </main>
  );
}

function How() {
  return (
    <section className="mt-10 rounded-2xl bg-primary-soft p-5">
      <h2 className="font-display text-xl font-semibold text-primary-ink">Why Rummlee</h2>
      <ul className="mt-3 space-y-3 text-sm text-fg">
        <li>
          <strong>Offers before Saturday.</strong> Neighbors browse while you’re still editing the closet.
        </li>
        <li>
          <strong>Privacy first.</strong> You deal as a handle. Real name, email, and home address never go on a
          listing.
        </li>
        <li>
          <strong>Partner stores.</strong> Meet at a grocery or home store with a Rummlee locker or pickup
          desk. Scan to confirm. The seller is paid after both of you do.
        </li>
        <li>
          <strong>Public place is backup.</strong> Park or library if a partner doesn’t work. Person to person is
          optional — still no address posted.
        </li>
      </ul>
    </section>
  );
}

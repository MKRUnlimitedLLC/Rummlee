import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { GuestGate, useAuthGate } from "@/components/guest-gate";
import { UserButton } from "@/lib/auth/gates";
import { signOut } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { ListingCard } from "@/components/listing-card";
import { LegalLinks } from "@/components/legal";
import { RateHandoff, ThumbTally, VerifiedBadge } from "@/components/trust";
import { NEIGHBORHOODS, TEST_MODE, TEST_PAY_NOTE } from "@/lib/rummlee/constants";
import { errMessage } from "@/lib/rummlee/errors";
import { money, saleWindow } from "@/lib/rummlee/format";
import { DEFAULT_FEES, feeById, formatFeeValue } from "@/lib/rummlee/fees";
import { getMe, togglePremium, topUpWallet, updateProfile, deleteMyAccount, verifyId, challengeRating } from "@/lib/rummlee/server";

export const Route = createFileRoute("/you")({ component: YouPage });

function YouPage() {
  const { user, showGuest, showLoading } = useAuthGate();
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
      toast.success("Test credits added. Not real money.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const premium = useMutation({
    mutationFn: (data: { plan?: "month" | "year"; cancel?: boolean }) => togglePremium({ data }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
      toast.success(
        res.isPremium
          ? res.plusPlan === "year"
            ? "Rummlee Plus on for a year. Official store fee waived on your side."
            : "Rummlee Plus on for a month. Official store fee waived on your side."
          : "Rummlee Plus off. Official store is $2.99 a side again.",
      );
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
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [challengeNote, setChallengeNote] = useState("");

  const verify = useMutation({
    mutationFn: () => verifyId(),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success(
        res.chargedCents > 0
          ? `Verified. ${TEST_MODE ? "Test credits" : "Wallet"} charged ${formatFeeValue(feeById(DEFAULT_FEES, "id_verify") ?? DEFAULT_FEES[0])}. No ID photo stored.`
          : "Verified. Free with Rummlee Plus. No ID photo stored.",
      );
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const challenge = useMutation({
    mutationFn: () => challengeRating({ data: { ratingId: challengeId!, note: challengeNote } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      setChallengeId(null);
      setChallengeNote("");
      toast.success("Challenge in. Neighbors won’t see that thumbs down while we look. They never see the comment.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const removeAccount = useMutation({
    mutationFn: () => deleteMyAccount(),
    onSuccess: async () => {
      toast.success("Account deleted.");
      await signOut().catch(() => undefined);
      window.location.assign("/");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  if (showGuest) {
    return (
      <GuestGate
        title="You"
        body="Your handle, wallet, and neighborhood live here. Neighbors see the handle — never your real name."
      >
        <ul className="mt-6 space-y-2 text-sm text-muted">
          <li className="rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">A handle, not your name</li>
          <li className="rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
            Wallet — test credits until both confirm
          </li>
          <li className="rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
            <Link to="/fees" className="font-medium text-primary-ink">
              Fees
            </Link>{" "}
            and Rummlee Plus — $2.99 official store each side, waived with Plus
          </li>
        </ul>
      </GuestGate>
    );
  }
  if (showLoading || !user) return <div className="py-16 text-center text-muted">Loading…</div>;
  const me = q.data?.me;

  return (
    <main className="py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Your handle</p>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">
            @{me?.handle ?? "…"} <VerifiedBadge verified={me?.verified} className="ml-1 align-middle" />
          </h1>
          <p className="mt-1 text-sm text-subtle">Neighbors see this. Your real name stays yours.</p>
          <ThumbTally up={me?.thumbsUp} down={me?.thumbsDown} className="mt-1 block" />
        </div>
        <UserButton />
      </div>

      <section className="mt-6 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
        <p className="text-sm text-muted">{TEST_MODE ? "Test credits" : "Wallet"}</p>
        <p className="font-display text-4xl font-medium tabular-nums tracking-[-0.03em]">{me ? money(me.walletCents) : "—"}</p>
        <p className="mt-1 text-sm text-subtle">
          {TEST_MODE ? TEST_PAY_NOTE : "Pay is held here until both of you confirm pickup."}
        </p>
        <div className="mt-4 flex gap-2">
          {[2000, 5000, 10000].map((c) => (
            <Button key={c} variant="secondary" size="sm" onClick={() => topUp.mutate(c)} disabled={topUp.isPending}>
              {TEST_MODE ? `Add ${money(c)} test` : `Add ${money(c)}`}
            </Button>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-bg px-3 py-3">
          <p className="font-medium">Rummlee Plus</p>
          <p className="mt-1 text-sm text-muted">
            Official store is {formatFeeValue(feeById(DEFAULT_FEES, "official_handoff") ?? DEFAULT_FEES[0])} each side per
            pickup. Plus waives <em>your</em> side when you buy or sell there. Buyer fee is 0% with Plus, 5% without.
            ID verification is free with Plus. Plus also includes a 3-day sale each month — extra sale days are $2.99
            each.
          </p>
          {me?.isPremium ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-fg">
                {me.plusPlan === "year" ? "Yearly" : "Monthly"}
                {me.plusUntil ? ` · through ${new Date(me.plusUntil).toLocaleDateString()}` : " · on"}
              </p>
              <Button size="sm" variant="secondary" onClick={() => premium.mutate({ cancel: true })} disabled={premium.isPending}>
                Turn off
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => premium.mutate({ plan: "month" })} disabled={premium.isPending}>
                {TEST_MODE ? "Plus, 1 month · $9.99 test" : "Plus, $9.99 / month"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => premium.mutate({ plan: "year" })} disabled={premium.isPending}>
                {TEST_MODE ? "Plus, 1 year · $99.99 test" : "Plus, $99.99 / year"}
              </Button>
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
        <p className="font-medium">Verified badge</p>
        <p className="mt-1 text-sm text-muted">
          ID check, one time. Free with Plus, or {formatFeeValue(feeById(DEFAULT_FEES, "id_verify") ?? DEFAULT_FEES[0])}.
          Rummlee does not keep a photo of your ID — neighbors see the badge and your handle, not your name.
        </p>
        {me?.verified ? (
          <p className="mt-3 text-sm text-fg">
            <VerifiedBadge verified /> You’re verified.
          </p>
        ) : (
          <Button className="mt-3" size="sm" onClick={() => verify.mutate()} disabled={verify.isPending}>
            {verify.isPending
              ? "Checking…"
              : me?.isPremium
                ? TEST_MODE
                  ? "Verify ID · free with Plus (test)"
                  : "Verify ID · free with Plus"
                : TEST_MODE
                  ? `Verify ID · ${formatFeeValue(feeById(DEFAULT_FEES, "id_verify") ?? DEFAULT_FEES[0])} test`
                  : `Verify ID · ${formatFeeValue(feeById(DEFAULT_FEES, "id_verify") ?? DEFAULT_FEES[0])}`}
          </Button>
        )}
      </section>

      {q.data?.pendingRates.length ? (
        <section className="mt-6 space-y-3">
          <h2 className="font-display text-xl">Rate a handoff</h2>
          {q.data.pendingRates.map((p) => (
            <RateHandoff key={p.orderId} orderId={p.orderId} role={p.role} otherHandle={p.otherHandle} />
          ))}
        </section>
      ) : null}

      {q.data?.receivedDowns.length ? (
        <section className="mt-6 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-xl">Thumbs down on you</h2>
          <p className="mt-1 text-sm text-muted">
            You see that it happened. You never see their comment. Challenge it if it wasn’t fair — we’ll hide it from
            neighbors while we look.
          </p>
          <ul className="mt-3 space-y-3">
            {q.data.receivedDowns.map((d) => (
              <li key={d.ratingId} className="rounded-xl bg-bg px-3 py-3">
                <p className="font-medium">{d.listingTitle}</p>
                <p className="text-sm text-muted">
                  {d.challengeStatus === "open"
                    ? "Challenged — hidden from neighbors while we look"
                    : d.challengeStatus === "removed"
                      ? "Removed after challenge"
                      : d.challengeStatus === "upheld"
                        ? "Challenge didn’t stand"
                        : "Thumbs down"}
                </p>
                {!d.challengeStatus ? (
                  challengeId === d.ratingId ? (
                    <form
                      className="mt-2 space-y-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        challenge.mutate();
                      }}
                    >
                      <textarea
                        className="min-h-20 w-full rounded-lg bg-surface px-3 py-2 text-[15px]"
                        required
                        minLength={8}
                        maxLength={500}
                        value={challengeNote}
                        onChange={(e) => setChallengeNote(e.target.value)}
                        placeholder="Why this thumbs down should come off. Private to Rummlee."
                      />
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={challenge.isPending}>
                          Submit challenge
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => setChallengeId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <Button className="mt-2" size="sm" variant="secondary" onClick={() => setChallengeId(d.ratingId)}>
                      Challenge
                    </Button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
            None yet. <Link to="/listings/new" className="font-medium text-primary-ink">List a sale</Link>
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
          <strong>Handoff locations.</strong> Official store, public place, or in person — the seller chooses which
          to offer. Scan to confirm. The seller is paid after both of you do.
        </li>
        <li>
          <strong>Never a home address.</strong> Even in person, you meet as handles.
        </li>
      </ul>
    </section>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { GuestGate, useAuthGate } from "@/components/guest-gate";
import { UserButton } from "@/lib/auth/gates";
import { signOut } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ListingCard } from "@/components/listing-card";
import { LegalLinks } from "@/components/legal";
import { RateHandoff, ThumbTally, VerifiedBadge } from "@/components/trust";
import { PlusAlerts } from "@/components/plus-alerts";
import { NEIGHBORHOODS, CITIES, IDENTITY_ENABLED, TEST_MODE, TEST_PAY_NOTE } from "@/lib/rummlee/constants";
import { errMessage } from "@/lib/rummlee/errors";
import { cityOf, money, saleWindow } from "@/lib/rummlee/format";
import { DEFAULT_FEES, feeById, formatFeeValue } from "@/lib/rummlee/fees";
import { getMe, togglePremium, topUpWallet, updateProfile, deleteMyAccount, exportMyData, verifyId, finishIdentityCheck, challengeRating, releaseIdentity, setHandle, stashListing, removeListing, restockListing } from "@/lib/rummlee/server";
import { getMyRep } from "@/lib/rummlee/rep";

export const Route = createFileRoute("/you")({ component: YouPage });

function YouPage() {
  const { user, showGuest, showLoading } = useAuthGate();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["me"],
    queryFn: () => getMe(),
    enabled: Boolean(user),
  });
  const repQ = useQuery({
    queryKey: ["my-rep"],
    queryFn: () => getMyRep(),
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
    mutationFn: (data: { plan?: "month" | "year" | "trio_month" | "trio_year"; cancel?: boolean }) => togglePremium({ data }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
      const name = res.plusTier === "trio" ? "Rummlee +++" : "Rummlee Plus";
      toast.success(
        res.isPremium
          ? res.plusPlan === "year"
            ? `${name} on for a year. Buyer fee is $0. The seller fee stays.`
            : `${name} on for a month. Buyer fee is $0. The seller fee stays.`
          : "Subscription off. Buyer fee is 5% again. The seller fee stays.",
      );
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const savePrivate = useMutation({
    mutationFn: () =>
      updateProfile({
        data: { city, neighborhood: hood, zip, legalFirstName: first, legalLastName: last, phone },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Saved. Neighbors still only see your handle.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [challengeNote, setChallengeNote] = useState("");
  const [releaseHandle, setReleaseHandle] = useState("");
  const [nextHandle, setNextHandle] = useState("");
  const [city, setCity] = useState("");
  const [hood, setHood] = useState("");
  const [zip, setZip] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const me = q.data?.me;
  useEffect(() => {
    if (!me) return;
    setCity(me.city ?? (me.neighborhood ? cityOf(me.neighborhood) : ""));
    setHood(me.neighborhood ?? "");
    setZip(me.zip ?? "");
    setFirst(me.legalFirstName ?? "");
    setLast(me.legalLastName ?? "");
    setPhone(me.phone ?? "");
  }, [me]);

  const handleSave = useMutation({
    mutationFn: () => setHandle({ data: { handle: nextHandle } }),
    onSuccess: (res) => {
      setNextHandle("");
      sessionStorage.setItem("rummlee.seenHandle", res.handle);
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
      toast.success(`Neighbors will see @${res.handle}.`);
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const verify = useMutation({
    mutationFn: () => verifyId(),
    onSuccess: (res) => {
      if (res.url) {
        window.location.assign(res.url);
        return;
      }
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("ID Verified is already on this account.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const finishVerify = useMutation({
    mutationFn: () => finishIdentityCheck(),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      window.history.replaceState(null, "", "/you");
      toast.success(
        res.chargedCents > 0
          ? "ID Verified. The name matched. No ID photo stored."
          : "ID Verified. Free with Plus. The name matched. No ID photo stored.",
      );
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const finishOnce = useRef(false);
  useEffect(() => {
    if (!IDENTITY_ENABLED || !user || finishOnce.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("identity") !== "return") return;
    finishOnce.current = true;
    finishVerify.mutate();
  }, [user, finishVerify]);

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

  const release = useMutation({
    mutationFn: () => releaseIdentity({ data: { handle: releaseHandle } }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success(`ID live on @${res.handle}. Ratings stayed with the ID.`);
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const downloadMine = useMutation({
    mutationFn: () => exportMyData(),
    onSuccess: (res) => {
      const blob = new Blob([res.json], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = res.filename;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success("Download started. Other people are handles only.");
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
            and memberships — buyer fee is 5%, or $0 with Plus and +++
          </li>
        </ul>
      </GuestGate>
    );
  }
  if (showLoading || !user) return <div className="py-16 text-center text-muted">Loading…</div>;

  return (
    <main className="py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Your handle</p>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">
            @{me?.handle ?? "…"} <VerifiedBadge verified={me?.verified} className="ml-1 align-middle" />
          </h1>
          <p className="mt-1 text-sm text-subtle">Neighbors see this. Your real name stays yours.</p>
          <form
            className="mt-3 flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              handleSave.mutate();
            }}
          >
            <Label htmlFor="handle" className="sr-only">
              New handle
            </Label>
            <Input
              id="handle"
              value={nextHandle}
              onChange={(event) => setNextHandle(event.target.value)}
              placeholder={me?.handle ?? "linen_lark"}
              autoCapitalize="off"
              autoCorrect="off"
              className="max-w-52"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={handleSave.isPending || nextHandle.trim().length < 3}>
              {handleSave.isPending ? "Saving…" : "Change handle"}
            </Button>
          </form>
          <p className="mt-1 text-sm text-muted">Neighbors never see your address — only a neighborhood label, if you set one.</p>
          <ThumbTally up={me?.thumbsUp} down={me?.thumbsDown} className="mt-1 block" />
          <p className="mt-1 text-sm text-fg">
            Rummlee Rep {repQ.data?.rep ?? me?.rep ?? 100}
            {repQ.data ? ` · ${repQ.data.catches} catches · ${repQ.data.facts} additions` : ""}
            {repQ.data && repQ.data.agreedUp + repQ.data.agreedDown >= 3
              ? ` · ${repQ.data.agreedUp}/${repQ.data.agreedUp + repQ.data.agreedDown} as listed`
              : ""}
            {repQ.data && repQ.data.dropoffs >= 3 ? ` · ${repQ.data.refused}/${repQ.data.dropoffs} refused at the counter` : ""}
          </p>
          <Link to="/rep" className="mt-1 inline-block text-sm font-medium text-primary-ink">
            Scoreboard
          </Link>
          <Link to="/research" className="mt-1 block text-sm font-medium text-primary-ink">
            Ask a researcher
          </Link>
          {q.data?.isDesk ? (
            <Link to="/desk" className="mt-2 inline-block text-sm font-medium text-primary-ink">
              Open the counter
            </Link>
          ) : null}
        </div>
        <UserButton />
      </div>

      <section className="mt-6 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
        <p className="text-sm text-muted">{TEST_MODE ? "Test credits" : "Wallet"}</p>
        <p className="font-display text-4xl font-medium tabular-nums tracking-[-0.03em]">{me ? money(me.walletCents) : "—"}</p>
        <p className="mt-1 text-sm text-subtle">
          {TEST_MODE ? TEST_PAY_NOTE : "Pay is held here until both of you confirm pickup."}{" "}
          <Link to="/records" className="font-medium text-primary-ink">
            Your records
          </Link>
        </p>
        <div className="mt-4 flex gap-2">
          {[2000, 5000, 10000].map((c) => (
            <Button key={c} variant="secondary" size="sm" onClick={() => topUp.mutate(c)} disabled={topUp.isPending}>
              {TEST_MODE ? `Add ${money(c)} test` : `Add ${money(c)}`}
            </Button>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-bg px-3 py-3">
          <p className="font-medium">Membership</p>
          <p className="mt-1 text-sm text-muted">
            Standard seller fee is $2.99 or 12%, whichever is more. Plus is $2.99 or 8.5%. +++ is $2.99 or 6%. The buyer
            fee is 5%, or $0 with Plus and +++. The seller fee is not waived, and it does not change for an official
            store, a public place, or in person. Plus includes 5 sale days a month. +++ sale days are free, with 5
            researcher requests, Reveal 5 times a month, and no item cap. Extra researches are $7.99. Unused researches
            and Reveals don’t roll over. Extra Plus sale days are $2.99. A single sale still runs at most 14 days.
            Before a sale closes you can add days. Feature one item for $1.99, or the whole sale for $4.99, until it
            ends. If test credits don’t cover a sale day or a feature, the rest comes out of your next payout.
            Plus and +++ can turn on alerts for new items and in-person sales. Nothing is sent until you pick a filter.
            After a sale ends, the seller can set a get-rid-of-it price. +++ gets one more offer on that unsold item.
            +++ can also see items being prepared, before the sale starts. The price stays hidden until the sale is on. Anyone with an account can favorite an item.
          </p>
          {me?.isPremium ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-fg">
                {me.plusTier === "trio" ? "+++" : "Plus"} · {me.plusPlan === "year" ? "Yearly" : "Monthly"}
                {me.plusUntil ? ` · through ${new Date(me.plusUntil).toLocaleDateString()}` : " · on"}
              </p>
              <Button size="sm" variant="secondary" onClick={() => premium.mutate({ cancel: true })} disabled={premium.isPending}>
                Turn off
              </Button>
              {me.plusTier !== "trio" ? (
                <Button size="sm" onClick={() => premium.mutate({ plan: "trio_month" })} disabled={premium.isPending}>
                  Move to +++ · $39.99
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => premium.mutate({ plan: "month" })} disabled={premium.isPending}>
                {TEST_MODE ? "Plus, 1 month · $9.99 test" : "Plus, $9.99 / month"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => premium.mutate({ plan: "year" })} disabled={premium.isPending}>
                {TEST_MODE ? "Plus, 1 year · $99.99 test" : "Plus, $99.99 / year"}
              </Button>
              <Button size="sm" onClick={() => premium.mutate({ plan: "trio_month" })} disabled={premium.isPending}>
                {TEST_MODE ? "+++ , 1 month · $39.99 test" : "+++ , $39.99 / month"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => premium.mutate({ plan: "trio_year" })} disabled={premium.isPending}>
                {TEST_MODE ? "+++ , 1 year · $399.99 test" : "+++ , $399.99 / year"}
              </Button>
            </div>
          )}
        </div>
      </section>

      <PlusAlerts plus={Boolean(me?.isPremium)} />

      <section className="mt-6 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
        <p className="font-medium">ID Verified</p>
        <p className="mt-1 text-sm text-muted">
          A badge on this account. Stripe Identity checks that the legal name matches the ID. Rummlee does not keep
          the photo. Free with Plus, or a one-time fee if you are not on Plus. Off during beta. Capped at 50 successful
          checks until we turn it up. One live account per ID. A new account does not clear thumbs.
        </p>
        {me?.verified ? (
          <p className="mt-3 text-sm text-fg">
            <VerifiedBadge verified /> On this account.
          </p>
        ) : IDENTITY_ENABLED ? (
          <Button className="mt-3" size="sm" onClick={() => verify.mutate()} disabled={verify.isPending}>
            {verify.isPending
              ? "Opening the ID check…"
              : me?.isPremium
                ? "Verify ID · free with Plus"
                : `Verify ID · ${formatFeeValue(feeById(DEFAULT_FEES, "id_verify") ?? DEFAULT_FEES[0])}`}
          </Button>
        ) : (
          <p className="mt-3 text-sm text-fg">ID checks are off during beta. No badge until we turn this on.</p>
        )}
      </section>

      {q.data?.pendingRates.length ? (
        <section className="mt-6 space-y-3">
          <h2 className="font-display text-xl">Rate a handoff</h2>
          {q.data.pendingRates.map((p) => (
            <RateHandoff key={p.orderId} orderId={p.orderId} role={p.role} otherHandle={p.otherHandle} handoffType={p.handoffType} />
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
        <p className="font-medium">City and neighborhood</p>
        <p className="mt-1 text-sm text-muted">Neighbors can see the neighborhood. Never a street.</p>
        <div className="mt-3 space-y-3">
          <div>
            <Label htmlFor="city">City</Label>
            <select
              id="city"
              className="h-11 w-full rounded-lg bg-bg px-3 text-[15px] shadow-[0_0_0_1px_rgba(28,25,21,0.1)]"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setHood("");
              }}
            >
              <option value="">Choose a city</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="hood">Neighborhood</Label>
            <select
              id="hood"
              className="h-11 w-full rounded-lg bg-bg px-3 text-[15px] shadow-[0_0_0_1px_rgba(28,25,21,0.1)]"
              value={hood}
              onChange={(e) => setHood(e.target.value)}
            >
              <option value="">Choose one</option>
              {(city ? NEIGHBORHOODS.filter((n) => cityOf(n) === city) : NEIGHBORHOODS).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="zip">Zip (optional)</Label>
            <Input id="zip" inputMode="numeric" autoComplete="postal-code" value={zip} onChange={(e) => setZip(e.target.value)} />
          </div>
        </div>
        <p className="mt-4 font-medium">Private</p>
        <p className="mt-1 text-sm text-muted">Legal name and phone stay on this account. They are not on listings.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="first">Legal first name</Label>
            <Input id="first" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="last">Legal last name</Label>
            <Input id="last" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
        </div>
        <div className="mt-3">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button className="mt-3" size="sm" onClick={() => savePrivate.mutate()} disabled={savePrivate.isPending}>
          {savePrivate.isPending ? "Saving…" : "Save"}
        </Button>
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
                    {!s.alwaysOn && s.endsOn.slice(0, 10) <= new Date(Date.now() + 86400000).toISOString().slice(0, 10)
                      ? " · Closing — extend it"
                      : ""}
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

      <SellerInventory items={q.data?.inventory ?? []} sales={q.data?.sales ?? []} />

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

      {me?.isStaff ? (
        <section className="mt-10 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-xl">Support — ID reset</h2>
          <p className="mt-2 text-sm text-muted">
            Makes this handle the live account for that ID. Thumbs do not reset.{" "}
            <Link to="/corporate" className="font-medium text-primary-ink">
              Corporate admissions
            </Link>
          </p>
          <p className="mt-2 text-sm text-muted">
            Makes this handle the live account for that ID. Thumbs do not reset.
          </p>
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              release.mutate();
            }}
          >
            <Input
              value={releaseHandle}
              onChange={(e) => setReleaseHandle(e.target.value)}
              placeholder="handle"
              className="max-w-xs"
            />
            <Button type="submit" size="sm" disabled={release.isPending || releaseHandle.trim().length < 2}>
              Set live account
            </Button>
          </form>
        </section>
      ) : null}

      <section className="mt-10 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl">Account</h2>
        <p className="mt-2 text-sm text-muted">
          Closing the account hides your handle and takes live listings down. Orders, fees, and tax records stay. Test
          credits are not paid out. Thumbs stay with your ID. Email support if you need the login back.
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          disabled={downloadMine.isPending}
          onClick={() => downloadMine.mutate()}
        >
          {downloadMine.isPending ? "Preparing…" : "Download my data"}
        </Button>
        <p className="mt-2 text-sm text-muted">
          A JSON file of your account, listings, offers, messages, and orders. Other neighbors are handles. No one
          else’s email is in the file.
        </p>
        {confirmDelete ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={removeAccount.isPending}
              onClick={() => removeAccount.mutate()}
            >
              {removeAccount.isPending ? "Closing…" : "Yes, close the account"}
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

function SellerInventory({
  items,
  sales,
}: {
  items: {
    id: string;
    title: string;
    priceCents: number;
    photoUrl: string;
    status: "stashed" | "unsold";
    saleName: string;
  }[];
  sales: { id: string; name: string; endsOn: string; alwaysOn?: boolean; status: string }[];
}) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const openSales = sales.filter((sale) => sale.status === "live" && (sale.alwaysOn || sale.endsOn.slice(0, 10) >= today));
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["me"] });
    void qc.invalidateQueries({ queryKey: ["bootstrap"] });
  };
  const stash = useMutation({
    mutationFn: (listingId: string) => stashListing({ data: { listingId } }),
    onSuccess: () => {
      toast.success("Stashed. It stays yours until you put it on a sale.");
      refresh();
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (listingId: string) => removeListing({ data: { listingId } }),
    onSuccess: () => {
      toast.success("Removed from your inventory.");
      refresh();
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const restock = useMutation({
    mutationFn: (data: { listingId: string; saleId: string }) => restockListing({ data }),
    onSuccess: () => {
      toast.success("It’s on that sale.");
      refresh();
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl">Your inventory</h2>
      <p className="mt-1 text-sm text-muted">
        Unsold items stay here after a sale. Stash one to sell it later. Remove one if you’re done with it.
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing waiting. Items still on a sale stay with that sale.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 rounded-2xl bg-surface p-3 shadow-[var(--shadow-card)]">
              <img src={item.photoUrl} alt="" className="size-16 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <Link to="/listings/$id" params={{ id: item.id }} className="font-medium">
                  {item.title}
                </Link>
                <p className="text-sm text-muted">
                  {money(item.priceCents)} · {item.status === "stashed" ? "Stashed" : `Unsold · ${item.saleName}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.status === "unsold" ? (
                    <Button size="sm" variant="secondary" disabled={stash.isPending} onClick={() => stash.mutate(item.id)}>
                      Stash
                    </Button>
                  ) : openSales.length ? (
                    <select
                      className="rounded-xl border border-border bg-bg px-2 py-1 text-sm"
                      defaultValue=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        restock.mutate({ listingId: item.id, saleId: e.target.value });
                        e.target.value = "";
                      }}
                    >
                      <option value="">Put on a sale</option>
                      {openSales.map((sale) => (
                        <option key={sale.id} value={sale.id}>
                          {sale.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-muted">Start a sale, then put this on it.</p>
                  )}
                  <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate(item.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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
          <strong>Address after you pay.</strong> Until then, a rough distance. Official partner store, public handoff location, or private handoff. Rummlee never ships.
        </li>
      </ul>
    </section>
  );
}

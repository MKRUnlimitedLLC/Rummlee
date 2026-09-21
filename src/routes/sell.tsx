import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { GuestGate, useAuthGate } from "@/components/guest-gate";
import { ModePicks } from "@/components/mode-picks";
import { PhotoInput } from "@/components/photo-input";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { CATEGORIES, CONDITIONS, HAULS, NEIGHBORHOODS, SALE_KINDS } from "@/lib/rummlee/constants";
import { errMessage } from "@/lib/rummlee/errors";
import { addDaysIso, cityOf, nextSaturdayIso, saleWindow } from "@/lib/rummlee/format";
import type { HandoffMode } from "@/lib/rummlee/types";
import { addListing, bootstrapPublic, createSale, getMe } from "@/lib/rummlee/server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sell")({ component: SellPage });

function SellPage() {
  const { user, showGuest, showLoading } = useAuthGate();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: () => getMe(),
    enabled: Boolean(user),
  });
  const bootQ = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => bootstrapPublic(),
    enabled: Boolean(user),
  });

  const [step, setStep] = useState<"sale" | "item">("item");
  const [saleId, setSaleId] = useState<string | null>(null);

  const [saleForm, setSaleForm] = useState({
    name: "",
    kind: "garage" as "garage" | "moving" | "clearout",
    neighborhood: NEIGHBORHOODS[0] as string,
    startsOn: nextSaturdayIso(),
    endsOn: nextSaturdayIso(),
    modes: ["official"] as HandoffMode[],
    handoffSpotId: "",
  });

  const [item, setItem] = useState({
    title: "",
    description: "",
    price: "",
    category: "furniture",
    condition: "Good",
    haul: "one",
    photoUrl: "",
    modes: ["official"] as HandoffMode[],
  });

  const liveSales = meQ.data?.sales.filter((s) => s.status === "live") ?? [];
  const activeSaleId = saleId ?? liveSales[0]?.id ?? null;

  const createMut = useMutation({
    mutationFn: () =>
      createSale({
        data: {
          name: saleForm.name.trim() || `${saleForm.neighborhood.split(",")[0]} ${SALE_KINDS.find((k) => k.id === saleForm.kind)?.label}`,
          kind: saleForm.kind,
          neighborhood: saleForm.neighborhood,
          startsOn: saleForm.startsOn,
          endsOn: saleForm.endsOn < saleForm.startsOn ? saleForm.startsOn : saleForm.endsOn,
          handoffModes: saleForm.modes,
          handoffSpotId: saleForm.handoffSpotId || null,
        },
      }),
    onSuccess: (res) => {
      setSaleId(res.id);
      setStep("item");
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Sale is live. Add your first item.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const addMut = useMutation({
    mutationFn: () => {
      if (!activeSaleId) throw new Error("Create a sale first.");
      const priceCents = Math.round(Number(item.price) * 100);
      return addListing({
        data: {
          saleId: activeSaleId,
          title: item.title.trim(),
          description: item.description.trim(),
          priceCents,
          buyNowCents: priceCents,
          category: item.category,
          condition: item.condition,
          haul: item.haul,
          photoUrl: item.photoUrl,
          handoffModes: item.modes,
        },
      });
    },
    onSuccess: (res) => {
      toast.success("Listed. Neighbors can offer before Saturday.");
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
      void navigate({ to: "/listings/$id", params: { id: res.id } });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  if (showGuest) return <SellGuest />;
  if (showLoading || !user) return <div className="py-16 text-center text-muted">Loading…</div>;

  const needSale = liveSales.length === 0 && !saleId;
  const spots = bootQ.data?.spots ?? [];
  const hoodSpots = spots.filter(
    (s) => s.area === saleForm.neighborhood || s.area.includes(cityOf(saleForm.neighborhood)),
  );

  return (
    <main className="mx-auto max-w-lg py-6">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">List it</h1>
      <p className="mt-1 text-muted">
        Photo, price, and a partner store. Public place is backup. Address stays off the listing.
      </p>
      <p className="mt-2 text-sm">
        <Link to="/listings/new" className="font-medium text-primary-ink">
          Paste a moving or clearout list
        </Link>
      </p>

      {needSale || step === "sale" ? (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate();
          }}
        >
          <h2 className="font-display text-xl">New sale event</h2>
          <div className="flex flex-wrap gap-2">
            {SALE_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setSaleForm((s) => ({ ...s, kind: k.id }))}
                className={cn(
                  "rounded-full px-3.5 py-2 text-sm font-medium",
                  saleForm.kind === k.id ? "bg-fg text-primary-fg" : "bg-surface text-muted shadow-[0_0_0_1px_rgba(28,25,21,0.08)]",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
          <div>
            <Label htmlFor="sale-name">Name</Label>
            <Input
              id="sale-name"
              value={saleForm.name}
              onChange={(e) => setSaleForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="Park Slope Saturday"
            />
          </div>
          <div>
            <Label htmlFor="hood">Neighborhood</Label>
            <select
              id="hood"
              className="h-11 w-full rounded-lg bg-surface px-3 text-[15px] shadow-[0_0_0_1px_rgba(28,25,21,0.1)]"
              value={saleForm.neighborhood}
              onChange={(e) => setSaleForm((s) => ({ ...s, neighborhood: e.target.value, handoffSpotId: "" }))}
            >
              {NEIGHBORHOODS.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="spot">Handoff</Label>
            <select
              id="spot"
              className="h-11 w-full rounded-lg bg-surface px-3 text-[15px] shadow-[0_0_0_1px_rgba(22,20,18,0.1)]"
              value={saleForm.handoffSpotId}
              onChange={(e) => setSaleForm((s) => ({ ...s, handoffSpotId: e.target.value }))}
            >
              <option value="">Closest official partner</option>
              {hoodSpots.filter((sp) => sp.kind === "partner").length > 0 ? (
                <optgroup label="Partner stores">
                  {hoodSpots
                    .filter((sp) => sp.kind === "partner")
                    .map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name}
                      </option>
                    ))}
                </optgroup>
              ) : null}
              {hoodSpots.filter((sp) => sp.kind === "public").length > 0 ? (
                <optgroup label="Public places">
                  {hoodSpots
                    .filter((sp) => sp.kind === "public")
                    .map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name}
                      </option>
                    ))}
                </optgroup>
              ) : null}
            </select>
            <p className="mt-1 text-sm text-muted">Partner store first. Public place if you need it. Never a home address.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="start">Starts</Label>
              <Input id="start" type="date" value={saleForm.startsOn} onChange={(e) => setSaleForm((s) => ({ ...s, startsOn: e.target.value, endsOn: s.endsOn < e.target.value ? e.target.value : s.endsOn }))} />
            </div>
            <div>
              <Label htmlFor="end">Ends</Label>
              <Input id="end" type="date" value={saleForm.endsOn} onChange={(e) => setSaleForm((s) => ({ ...s, endsOn: e.target.value }))} />
            </div>
          </div>
          <ModePicks value={saleForm.modes} onChange={(modes) => setSaleForm((s) => ({ ...s, modes }))} />
          <Button type="submit" className="w-full" disabled={createMut.isPending}>
            {createMut.isPending ? "Creating…" : "Create sale & add items"}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted"
            onClick={() => setSaleForm((s) => ({ ...s, endsOn: addDaysIso(s.startsOn, 1) }))}
          >
            Make it a two-day weekend
          </button>
        </form>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            addMut.mutate();
          }}
        >
          {liveSales.length > 0 ? (
            <div>
              <Label htmlFor="sale">List in</Label>
              <select
                id="sale"
                className="h-11 w-full rounded-lg bg-surface px-3 text-[15px] shadow-[0_0_0_1px_rgba(28,25,21,0.1)]"
                value={activeSaleId ?? ""}
                onChange={(e) => setSaleId(e.target.value)}
              >
                {liveSales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {saleWindow(s.startsOn, s.endsOn)}
                  </option>
                ))}
              </select>
              <button type="button" className="mt-2 text-sm font-medium text-primary-ink" onClick={() => setStep("sale")}>
                Start another sale
              </button>
            </div>
          ) : null}
          <PhotoInput value={item.photoUrl} onChange={(photoUrl) => setItem((s) => ({ ...s, photoUrl }))} />
          <div>
            <Label htmlFor="title">What is it?</Label>
            <Input id="title" value={item.title} onChange={(e) => setItem((s) => ({ ...s, title: e.target.value }))} required placeholder="Bouclé lounge chair" />
          </div>
          <div>
            <Label htmlFor="price">Asking price</Label>
            <Input id="price" inputMode="decimal" value={item.price} onChange={(e) => setItem((s) => ({ ...s, price: e.target.value }))} required placeholder="40" />
            <p className="mt-1 text-sm text-muted">$5 minimum. Neighbors can offer under asking.</p>
          </div>
          <div>
            <Label htmlFor="desc">Describe it to a neighbor</Label>
            <Textarea id="desc" value={item.description} onChange={(e) => setItem((s) => ({ ...s, description: e.target.value }))} placeholder="Cream bouclé, one faint mark on the left arm." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <select className="h-11 w-full rounded-lg bg-surface px-3 text-[15px] shadow-[0_0_0_1px_rgba(28,25,21,0.1)]" value={item.category} onChange={(e) => setItem((s) => ({ ...s, category: e.target.value }))}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Haul</Label>
              <select className="h-11 w-full rounded-lg bg-surface px-3 text-[15px] shadow-[0_0_0_1px_rgba(28,25,21,0.1)]" value={item.haul} onChange={(e) => setItem((s) => ({ ...s, haul: e.target.value }))}>
                {HAULS.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setItem((s) => ({ ...s, condition: c }))}
                className={cn(
                  "rounded-full px-3.5 py-2 text-sm font-medium",
                  item.condition === c ? "bg-fg text-primary-fg" : "bg-surface text-muted shadow-[0_0_0_1px_rgba(28,25,21,0.08)]",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <ModePicks value={item.modes} onChange={(modes) => setItem((s) => ({ ...s, modes }))} />
          <Button type="submit" className="w-full" disabled={addMut.isPending || !item.photoUrl}>
            {addMut.isPending ? "Listing…" : "List this item"}
          </Button>
          <p className="text-center text-sm text-muted">
            Free to list. Fees when it sells. <Link to="/you">Wallet</Link>
          </p>
        </form>
      )}
    </main>
  );
}

function SellGuest() {
  return (
    <GuestGate
      title="List it"
      body="Photo, price, and a partner store. A public place is backup. A home address never goes on the listing."
    >
      <Button asChild className="mt-5 w-full">
        <Link to="/listings/new">Start a photo and asking draft</Link>
      </Button>
      <p className="mt-2 text-sm text-muted">Save it on this device, then sign in to publish. You can paste a moving or clearout list.</p>
      <ol className="mt-6 space-y-2">
        <li className="rounded-2xl bg-primary-soft px-4 py-3">
          <p className="text-sm font-medium">1. Partner store</p>
          <p className="mt-0.5 text-sm text-muted">Default. Locker or pickup desk, store hours.</p>
        </li>
        <li className="rounded-2xl bg-surface px-4 py-3 shadow-[0_0_0_1px_rgba(22,20,18,0.08)]">
          <p className="text-sm font-medium">2. Public place</p>
          <p className="mt-0.5 text-sm text-muted">Backup. Park, library, or civic lot.</p>
        </li>
        <li className="rounded-2xl bg-surface px-4 py-3 shadow-[0_0_0_1px_rgba(22,20,18,0.08)]">
          <p className="text-sm font-medium">3. Person to person</p>
          <p className="mt-0.5 text-sm text-muted">Optional. Still no home address.</p>
        </li>
      </ol>
    </GuestGate>
  );
}

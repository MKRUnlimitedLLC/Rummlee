import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ModePicks } from "@/components/mode-picks";
import { PhotoInput } from "@/components/photo-input";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useAuthGate } from "@/components/guest-gate";
import { CATEGORIES, CONDITIONS, HAULS, MIN_PRICE_CENTS, NEIGHBORHOODS, PASTE_CAP, PLUS_SALE_DAYS_PER_MONTH, SALE_KINDS } from "@/lib/rummlee/constants";
import {
  blankLine,
  guessCategory,
  guessHaul,
  lastCity,
  loadDraft,
  neighborhoodForCity,
  parsePasteList,
  rememberAfterLogin,
  saveDraft,
  takeAfterLogin,
  SELL_PRESETS,
  type DraftLine,
  type ListingDraft,
} from "@/lib/rummlee/draft";
import { errMessage } from "@/lib/rummlee/errors";
import { cityOf, money, nextSaturdayIso, splitModes } from "@/lib/rummlee/format";
import { countSaleDays, DEFAULT_FEES, feeById, formatFeeValue, quoteSaleDays } from "@/lib/rummlee/fees";
import { addListing, bootstrapPublic, createSale, getMe, topUpWallet } from "@/lib/rummlee/server";
import type { HandoffMode } from "@/lib/rummlee/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/listings/new")({
  component: NewListingPage,
});

function freshDraft(): ListingDraft {
  const city = lastCity();
  const fromCity = neighborhoodForCity(city);
  const sat = nextSaturdayIso();
  return {
    kind: "moving",
    neighborhood: fromCity ?? (city === "Fargo–Moorhead" ? "West Fargo, Fargo–Moorhead" : NEIGHBORHOODS[0]),
    modes: ["official"],
    handoffSpotId: "",
    startsOn: sat,
    endsOn: sat,
    channel: "online",
    physicalLocation: "",
    hoursStart: "09:00",
    hoursEnd: "15:00",
    onlineStartDow: 2,
    onlineEndDow: 4,
    liveOn: false,
    liveStartDow: 5,
    liveEndDow: 0,
    liveOpen: "09:00",
    liveClose: "15:00",
    meetupNote: "",
    lines: [blankLine({ id: "draft-line" })],
  };
}

function NewListingPage() {
  const { user, showLoading } = useAuthGate();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const bootQ = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => bootstrapPublic(),
  });
  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: () => getMe(),
    enabled: Boolean(user),
  });

  const [draft, setDraft] = useState<ListingDraft>(freshDraft);
  const [paste, setPaste] = useState("");
  const [saved, setSaved] = useState(false);
  const [step, setStep] = useState(1);
  const [publishNote, setPublishNote] = useState<string | null>(null);

  useEffect(() => {
    const savedDraft = loadDraft();
    const city = lastCity();
    const fromCity = neighborhoodForCity(city);
    if (!savedDraft?.lines?.length) return;
    const draftCity = cityOf(savedDraft.neighborhood);
    if (fromCity && city !== "all" && draftCity !== city) {
      setDraft({ ...savedDraft, neighborhood: fromCity });
      return;
    }
    setDraft(savedDraft);
  }, []);

  useEffect(() => {
    const named = draft.lines.some((line) => line.title.trim() || line.price.trim() || line.photoUrl);
    if (!named) return;
    try {
      saveDraft(draft);
    } catch {
      /* ignore quota */
    }
  }, [draft]);

  useEffect(() => {
    if (user) takeAfterLogin();
  }, [user]);

  const spots = bootQ.data?.spots ?? [];
  const hoodSpots = spots.filter(
    (spot) => spot.area === draft.neighborhood || spot.area.includes(cityOf(draft.neighborhood)),
  );

  function updateLine(id: string, patch: Partial<DraftLine>) {
    setSaved(false);
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    }));
  }

  function applyPaste() {
    const parsed = parsePasteList(paste);
    if (!parsed.length) {
      toast.error("Add one item per line.");
      return;
    }
    setSaved(false);
    setDraft((current) => {
      const empty = current.lines.every((line) => !line.title.trim() && !line.price.trim());
      const nextLines = parsed.map((row) => {
          const category = guessCategory(row.title, current.kind === "moving" ? "furniture" : current.kind === "clearout" ? "kitchen" : "other");
          return blankLine({
            title: row.title,
            price: row.price,
            sizeLabel: row.sizeLabel,
            category,
            haul: guessHaul(category, row.title, current.kind === "moving" ? "two" : "one"),
          });
        });
      return { ...current, lines: empty ? nextLines : [...current.lines, ...nextLines].slice(0, PASTE_CAP) };
    });
    setPaste("");
    toast.success(parsed.length === 1 ? "Added 1 item." : `Added ${parsed.length} items.`);
  }

  const publish = useMutation({
    mutationFn: async () => {
      if (!user?.id || meQ.data?.me?.id !== user.id) {
        throw new Error("Sign in again, then publish. The listing has to be yours.");
      }
      const ready = draft.lines.filter((line) => line.title.trim() && line.photoUrl && dollarsToCents(line.price) >= MIN_PRICE_CENTS);
      if (!ready.length) throw new Error("Each item needs a photo of that item and an asking price of at least $5.");
      if (ready.some((line) => line.photoUrl.startsWith("/listings/"))) {
        throw new Error("Use your own photo. Sample listing pictures can’t be reused.");
      }
      const modes = splitModes(draft.modes.join(","));
      const liveMatch =
        draft.saleId && meQ.data?.sales.some((sale) => sale.id === draft.saleId && sale.status === "live")
          ? draft.saleId
          : undefined;
      let saleId = liveMatch;
      if (!saleId) {
        const kind = SALE_KINDS.find((item) => item.id === draft.kind);
        const created = await createSale({
          data: {
            name: `${draft.neighborhood.split(",")[0]} ${kind?.label ?? "Sale"}`.slice(0, 80),
            kind: draft.kind,
            neighborhood: draft.neighborhood,
            startsOn: draft.startsOn,
            endsOn: draft.endsOn,
            channel: draft.liveOn ? "both" : "online",
            physicalLocation: undefined,
            hoursStart: draft.liveOn ? draft.liveOpen : undefined,
            hoursEnd: draft.liveOn ? draft.liveClose : undefined,
            onlineStartDow: draft.onlineStartDow,
            onlineEndDow: draft.onlineEndDow,
            liveOn: draft.liveOn,
            liveStartDow: draft.liveStartDow,
            liveEndDow: draft.liveEndDow,
            liveOpen: draft.liveOpen,
            liveClose: draft.liveClose,
            meetupNote: draft.meetupNote,
            handoffModes: modes,
            handoffSpotId: draft.handoffSpotId || null,
          },
        });
        saleId = created.id;
      }
      const ids: string[] = [];
      for (const line of ready) {
        const priceCents = dollarsToCents(line.price);
        const floorCents = dollarsToCents(line.floor || line.price);
        if (floorCents > priceCents) throw new Error(`Lowest for “${line.title.trim()}” can’t be higher than asking.`);
        const created = await addListing({
          data: {
            saleId,
            title: line.title.trim(),
            description: line.description.trim(),
            priceCents,
            floorCents,
            buyNowCents: priceCents,
            category: line.category,
            condition: line.condition,
            haul: line.haul,
            photoUrl: line.photoUrl,
            sizeLabel: line.sizeLabel.trim() || undefined,
            handoffModes: modes,
          },
        });
        ids.push(created.id);
      }
      return { saleId, ids };
    },
    onSuccess: ({ saleId, ids }) => {
      setPublishNote(null);
      saveDraft({ ...draft, saleId, lines: [blankLine({ category: draft.lines[0]?.category ?? "furniture", haul: draft.lines[0]?.haul ?? "one" })] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success(ids.length === 1 ? "Published. Add another item to this sale if you want." : `Published ${ids.length} items. Add another to this sale if you want.`);
      if (ids.length === 1) void navigate({ to: "/listings/$id", params: { id: ids[0] } });
      else void navigate({ to: "/sales/$id", params: { id: saleId } });
    },
    onError: (error) => {
      const message = errMessage(error);
      setPublishNote(message);
      toast.error(message);
    },
  });

  const addCredits = useMutation({
    mutationFn: () => topUpWallet({ data: 2000 }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      setPublishNote(null);
      toast.success("Test credits added. Not real money. You can publish now.");
    },
    onError: (error) => {
      const message = errMessage(error);
      setPublishNote(message);
      toast.error(message);
    },
  });

  function onSaveDraft() {
    const named = draft.lines.some((line) => line.title.trim() || line.price.trim() || line.photoUrl);
    const askingFilled = draft.lines.some((line) => line.price.trim());
    const photoMissing = draft.lines.every((line) => !line.photoUrl);
    if (askingFilled && photoMissing) {
      toast.error("Add a photo to save this draft.");
      return;
    }
    if (!named) {
      toast.error("Add a photo to save this draft.");
      return;
    }
    try {
      saveDraft(draft);
      rememberAfterLogin("/listings/new");
      setSaved(true);
      toast.success("Draft saved on this device.");
    } catch {
      toast.error("This draft is too big for this browser. Remove a photo and try again.");
    }
  }

  const saleDays = countSaleDays(draft.startsOn, draft.endsOn);
  const dayFeeCents = feeById(DEFAULT_FEES, "sale_day")?.amountCents ?? 299;
  const plus = Boolean(meQ.data?.me.isPremium);
  const freeLeft = meQ.data?.plusSaleDaysLeft ?? 0;
  const saleQuote = quoteSaleDays({
    dayFeeCents,
    days: saleDays,
    plus,
    freeUsed: plus ? Math.max(0, PLUS_SALE_DAYS_PER_MONTH - freeLeft) : 0,
    freePerMonth: PLUS_SALE_DAYS_PER_MONTH,
  });
  const wallet = meQ.data?.me.walletCents ?? 0;
  const saleShort = Boolean(user) && saleQuote.chargeCents > wallet;

  return (
    <main className="mx-auto max-w-lg py-6">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">List it</h1>
      <p className="mt-1 text-muted">
        Three short screens. Photo and asking first. Sale dates and handoffs next. Details last.
      </p>
      <p className="mt-2 text-sm text-muted">
        <Link to="/sell" className="font-medium text-primary-ink">
          How handoff works
        </Link>
      </p>
      <ol className="mt-4 grid grid-cols-3 gap-2 text-sm">
        {["Photo & asking", "Sale & handoff", "Details"].map((label, index) => (
          <li
            key={label}
            className={cn(
              "rounded-full px-2 py-1.5 text-center font-medium",
              step === index + 1 ? "bg-fg text-primary-fg" : "bg-surface text-muted",
            )}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (step < 3) {
            if (step === 1) {
              const active = draft.lines.filter((line) => line.title.trim() || line.price.trim() || line.photoUrl);
              const rows = active.length ? active : draft.lines.slice(0, 1);
              if (rows.some((line) => !line.photoUrl)) {
                toast.error("Add a photo of this item before you continue.");
                return;
              }
            }
            setStep((s) => s + 1);
            return;
          }
          if (!user) onSaveDraft();
          else publish.mutate();
        }}
      >
        <div className={cn(step === 1 ? "space-y-4" : "hidden")}>
          <div className="flex flex-wrap gap-2">
          {SALE_KINDS.map((kind) => (
            <button
              key={kind.id}
              type="button"
              onClick={() => {
                setSaved(false);
                setDraft((current) => ({ ...current, kind: kind.id }));
              }}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm font-medium",
                draft.kind === kind.id ? "bg-fg text-primary-fg" : "bg-surface text-muted shadow-[0_0_0_1px_rgba(28,25,21,0.08)]",
              )}
            >
              {kind.label}
            </button>
          ))}
          </div>
        <p className="text-sm text-muted">{SALE_KINDS.find((kind) => kind.id === draft.kind)?.blurb}</p>

        <div className="flex flex-wrap gap-2">
          {SELL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setSaved(false);
                setPaste(preset.sample);
                setDraft((current) => ({
                  ...current,
                  kind: preset.kind,
                  modes: preset.modes,
                  lines: current.lines.every((line) => !line.title.trim() && !line.photoUrl)
                    ? [blankLine({ category: preset.category, haul: preset.haul })]
                    : current.lines,
                }));
                toast.message(preset.hint);
              }}
              className="rounded-full bg-primary-soft px-3.5 py-2 text-sm font-medium text-primary-ink"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
          <Label htmlFor="paste">Paste a list</Label>
          <p className="mt-1 text-sm text-muted">
            One item per line. Price at the end. Clothing: title · size · price. Up to {PASTE_CAP}.
          </p>
          <Textarea
            id="paste"
            className="mt-2"
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            placeholder={"Cream sofa · 90\nCamel cashmere · M · 48\nStand mixer · 95"}
          />
          <button type="button" className="mt-2 text-sm font-medium text-primary-ink" onClick={applyPaste}>
            Add these rows
          </button>
        </div>
        </div>

        <div className={cn(step === 2 ? "space-y-4" : "hidden")}>
        {draft.saleId ? (
          <p className="rounded-xl bg-primary-soft px-3 py-2 text-sm text-fg">
            Adding to your current sale. Dates and sale-day fees already apply.
          </p>
        ) : (
          <SaleDates
            draft={draft}
            plus={Boolean(meQ.data?.me.isPremium)}
            freeLeft={meQ.data?.plusSaleDaysLeft ?? 0}
            onChange={(patch) => {
              setSaved(false);
              setDraft((current) => ({ ...current, ...patch }));
            }}
          />
        )}
        <div>
          <Label htmlFor="hood">Neighborhood</Label>
          <select
            id="hood"
            className="h-11 w-full rounded-lg bg-surface px-3 text-base shadow-[0_0_0_1px_rgba(28,25,21,0.1)]"
            value={draft.neighborhood}
            onChange={(event) => {
              setSaved(false);
              setDraft((current) => ({ ...current, neighborhood: event.target.value, handoffSpotId: "" }));
            }}
          >
            {NEIGHBORHOODS.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="spot">Handoff location</Label>
          <select
            id="spot"
            className="h-11 w-full rounded-lg bg-surface px-3 text-base shadow-[0_0_0_1px_rgba(22,20,18,0.1)]"
            value={draft.handoffSpotId}
            onChange={(event) => setDraft((current) => ({ ...current, handoffSpotId: event.target.value }))}
          >
            <option value="">Closest official store</option>
            {hoodSpots.some((spot) => spot.kind === "partner") ? (
              <optgroup label="Official store handoff">
                {hoodSpots
                  .filter((spot) => spot.kind === "partner")
                  .map((spot) => (
                    <option key={spot.id} value={spot.id}>
                      {spot.name}
                    </option>
                  ))}
              </optgroup>
            ) : null}
            {hoodSpots.some((spot) => spot.kind === "public") ? (
              <optgroup label="Public place handoff">
                {hoodSpots
                  .filter((spot) => spot.kind === "public")
                  .map((spot) => (
                    <option key={spot.id} value={spot.id}>
                      {spot.name}
                    </option>
                  ))}
              </optgroup>
            ) : null}
          </select>
          <p className="mt-1 text-sm text-muted">Official store is the default. Add public place or in person if you want. Never a home address.</p>
        </div>

        <ModePicks
          value={draft.modes}
          onChange={(modes) => {
            setSaved(false);
            setDraft((current) => ({ ...current, modes }));
          }}
        />
        </div>

        {draft.lines.map((line, index) => (
          <fieldset key={line.id} className="space-y-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
            <legend className="px-1 text-sm font-medium">Item {index + 1}</legend>
            <div className={cn(step === 1 ? "space-y-3" : "hidden")}>
            <PhotoInput value={line.photoUrl} onChange={(photoUrl) => updateLine(line.id, { photoUrl })} />
            <p className="text-base font-medium">Add a photo of this item before you continue.</p>
            <div>
              <Label htmlFor={`title-${line.id}`}>What is it?</Label>
              <Input
                id={`title-${line.id}`}
                value={line.title}
                onChange={(event) => updateLine(line.id, { title: event.target.value })}
                placeholder="Cream sofa"
              />
            </div>
            <div>
              <Label htmlFor={`price-${line.id}`}>Asking price</Label>
              <Input
                id={`price-${line.id}`}
                inputMode="decimal"
                value={line.price}
                onChange={(event) => updateLine(line.id, { price: event.target.value })}
                placeholder="90"
              />
              <p className="mt-1 text-sm text-muted">Neighbors see this. They can pay it, or send one offer under it.</p>
            </div>
            {line.category === "clothing" || line.category === "kids" || line.sizeLabel ? (
              <div>
                <Label htmlFor={`size-${line.id}`}>{line.category === "kids" ? "Size / age" : "Size"}</Label>
                <Input
                  id={`size-${line.id}`}
                  value={line.sizeLabel}
                  onChange={(event) => updateLine(line.id, { sizeLabel: event.target.value })}
                  placeholder={line.category === "kids" ? "16\" / ages 4–6" : "M / L / 32×30"}
                />
              </div>
            ) : null}
            </div>
            <div className={cn(step === 2 ? "space-y-3" : "hidden")}>
            <div>
              <Label htmlFor={`floor-${line.id}`}>Lowest you’ll take</Label>
              <Input
                id={`floor-${line.id}`}
                inputMode="decimal"
                value={line.floor}
                onChange={(event) => updateLine(line.id, { floor: event.target.value })}
                placeholder="Same as asking if you skip this"
              />
              <p className="mt-1 text-sm text-muted">Hidden. Offers below this are a no. One decline from either of you ends the offer.</p>
            </div>
            </div>
            <div className={cn(step === 3 ? "space-y-3" : "hidden")}>
            {line.photoUrl ? (
              <div className="overflow-hidden rounded-xl bg-bg">
                <img src={line.photoUrl} alt={line.title.trim() || "Your listing photo"} className="aspect-[4/3] w-full object-cover" />
                <p className="px-3 py-2 text-sm font-medium">
                  This photo publishes as {line.title.trim() ? `“${line.title.trim()}”` : "this item"}. Change the photo if that’s the wrong thing.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">Add a photo of this item on screen 1 before you publish.</p>
            )}
            <div>
              <Label htmlFor={`desc-${line.id}`}>Note</Label>
              <Textarea
                id={`desc-${line.id}`}
                value={line.description}
                onChange={(event) => updateLine(line.id, { description: event.target.value })}
                placeholder={draft.kind === "moving" && draft.modes.length === 1 ? "Lobby / elevator rules if this is a building item." : "One cushion is a little sat."}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <select
                  className="h-11 w-full rounded-lg bg-bg px-3 text-base"
                  value={line.category}
                  onChange={(event) =>
                    updateLine(line.id, {
                      category: event.target.value,
                      haul: guessHaul(event.target.value, line.title, line.haul),
                    })
                  }
                >
                  {CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Haul</Label>
                <select
                  className="h-11 w-full rounded-lg bg-bg px-3 text-base"
                  value={line.haul}
                  onChange={(event) => updateLine(line.id, { haul: event.target.value })}
                >
                  {HAULS.map((haul) => (
                    <option key={haul.id} value={haul.id}>
                      {haul.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((condition) => (
                <button
                  key={condition}
                  type="button"
                  onClick={() => updateLine(line.id, { condition })}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-sm font-medium",
                    line.condition === condition ? "bg-fg text-primary-fg" : "bg-bg text-muted",
                  )}
                >
                  {condition}
                </button>
              ))}
            </div>
            </div>
            {draft.lines.length > 1 && step === 1 ? (
              <button
                type="button"
                className="text-sm text-muted"
                onClick={() =>
                  setDraft((current) => ({ ...current, lines: current.lines.filter((item) => item.id !== line.id) }))
                }
              >
                Remove this item
              </button>
            ) : null}
          </fieldset>
        ))}

        {step === 1 ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => setDraft((current) => ({ ...current, lines: [...current.lines, blankLine({ category: current.lines[0]?.category ?? "furniture", haul: current.lines[0]?.haul ?? "one" })].slice(0, PASTE_CAP) }))}
        >
          Add another item to this sale
        </Button>
        ) : null}

        {publishNote ? (
          <p className="rounded-xl bg-primary-soft px-3 py-2 text-sm text-fg">{publishNote}</p>
        ) : null}
        {step === 3 && user && saleQuote.chargeCents > 0 ? (
          <p className="text-sm text-fg">
            This sale is {money(saleQuote.chargeCents)} in test credits ({saleQuote.paidDays} date
            {saleQuote.paidDays === 1 ? "" : "s"}). You have {money(wallet)}.
          </p>
        ) : null}
        {step === 3 && saleShort ? (
          <Button type="button" variant="secondary" className="w-full" disabled={addCredits.isPending} onClick={() => addCredits.mutate()}>
            {addCredits.isPending ? "Adding test credits…" : "Add $20 test credits, then publish"}
          </Button>
        ) : null}
        <div className="flex gap-2">
          {step > 1 ? (
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          ) : null}
          {step < 3 ? (
            <Button
              type="submit"
              className="flex-1"
              disabled={step === 1 && draft.lines.every((line) => !line.photoUrl)}
            >
              Next
            </Button>
          ) : showLoading ? (
            <Button type="button" className="flex-1" disabled>
              Checking your account…
            </Button>
          ) : user ? (
            <Button type="submit" className="flex-1" disabled={publish.isPending || meQ.isPending || saleShort}>
              {publish.isPending ? "Publishing…" : meQ.data?.me.handle ? `Publish as @${meQ.data.me.handle}` : "Publish"}
            </Button>
          ) : (
            <Button type="submit" className="flex-1">
              Save draft, then sign in
            </Button>
          )}
        </div>
        <p className="text-center text-sm text-muted">
          <Link to="/fees" className="font-medium text-primary-ink">
            Fees
          </Link>
          {" "}
          only show here if you charge to list, and at checkout.
        </p>
      </form>

      {saved && !user ? (
        <div className="mt-4 rounded-[24px] bg-primary-soft p-5">
          <p className="font-medium">Draft saved on this device.</p>
          <p className="mt-1 text-sm text-muted">Draft on this device — sign in to publish.</p>
          <Button asChild className="mt-4 w-full">
            <Link to="/login">Sign in to publish</Link>
          </Button>
        </div>
      ) : null}
    </main>
  );
}

function SaleDates({
  draft,
  plus,
  freeLeft,
  onChange,
}: {
  draft: ListingDraft;
  plus: boolean;
  freeLeft: number;
  onChange: (patch: Partial<ListingDraft>) => void;
}) {
  const days = countSaleDays(draft.startsOn, draft.endsOn);
  const dayFee = feeById(DEFAULT_FEES, "sale_day");
  const dayFeeCents = dayFee?.amountCents ?? 299;
  const quote = quoteSaleDays({
    dayFeeCents,
    days,
    plus,
    freeUsed: plus ? Math.max(0, PLUS_SALE_DAYS_PER_MONTH - freeLeft) : 0,
    freePerMonth: PLUS_SALE_DAYS_PER_MONTH,
  });
  return (
    <div className="space-y-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
      <p className="font-medium">Sale dates</p>
      <p className="text-sm text-muted">
        {formatFeeValue(dayFee ?? DEFAULT_FEES[0])} per date. Plus includes {PLUS_SALE_DAYS_PER_MONTH} days each month
        free.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="starts">Starts</Label>
          <Input
            id="starts"
            type="date"
            value={draft.startsOn}
            onChange={(e) => {
              const startsOn = e.target.value;
              onChange({ startsOn, endsOn: draft.endsOn < startsOn ? startsOn : draft.endsOn });
            }}
          />
        </div>
        <div>
          <Label htmlFor="ends">Ends</Label>
          <Input
            id="ends"
            type="date"
            value={draft.endsOn}
            onChange={(e) => onChange({ endsOn: e.target.value })}
          />
        </div>
      </div>
      <p className="text-sm text-fg">
        {days < 1
          ? "End date has to be on or after the start."
          : quote.chargeCents === 0
            ? `${days} day${days === 1 ? "" : "s"} · ${plus ? "covered by Plus this month" : "free (no sale-day fee set)"}`
            : `${days} day${days === 1 ? "" : "s"} · ${quote.freeDays ? `${quote.freeDays} Plus free · ` : ""}${quote.paidDays} × ${money(dayFeeCents)} = ${money(quote.chargeCents)}`}
      </p>
      <div>
        <p className="text-sm font-medium">Online window</p>
        <p className="mt-1 text-sm text-muted">Offers and pay-asking stay open these days. Default is Tuesday through Thursday.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <DowSelect id="online-start" label="Online from" value={draft.onlineStartDow} onChange={(onlineStartDow) => onChange({ onlineStartDow })} />
          <DowSelect id="online-end" label="Online through" value={draft.onlineEndDow} onChange={(onlineEndDow) => onChange({ onlineEndDow })} />
        </div>
      </div>
      <div>
        <button
          type="button"
          className={cn(
            "rounded-full px-3.5 py-2 text-sm font-medium",
            draft.liveOn ? "bg-fg text-primary-fg" : "bg-bg text-muted",
          )}
          onClick={() => onChange({ liveOn: !draft.liveOn, channel: !draft.liveOn ? "both" : "online" })}
        >
          {draft.liveOn ? "Live in-person hours on" : "Add live in-person hours"}
        </button>
        <p className="mt-1 text-sm text-muted">
          Optional. Neighbors see the days and hours, plus the neighborhood. Never a street address.
        </p>
      </div>
      {draft.liveOn ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <DowSelect id="live-start" label="In person from" value={draft.liveStartDow} onChange={(liveStartDow) => onChange({ liveStartDow })} />
            <DowSelect id="live-end" label="In person through" value={draft.liveEndDow} onChange={(liveEndDow) => onChange({ liveEndDow })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="lopen">Opens</Label>
              <Input id="lopen" type="time" value={draft.liveOpen} onChange={(e) => onChange({ liveOpen: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="lclose">Closes</Label>
              <Input id="lclose" type="time" value={draft.liveClose} onChange={(e) => onChange({ liveClose: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="meetup">In-person meetup note</Label>
            <Textarea
              id="meetup"
              value={draft.meetupNote}
              onChange={(e) => onChange({ meetupNote: e.target.value })}
              placeholder="Neighborhood meetup after you pay. No house number."
              rows={2}
            />
            <p className="mt-1 text-sm text-muted">
              Shown only after someone pays for in-person handoff. It never goes on Browse, and an official-store pickup does not reveal it.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Live hours off. This sale stays online for its whole run.</p>
      )}
    </div>
  );
}

function dollarsToCents(price: string) {
  const amount = Number(price);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

const WEEKDAYS = [
  ["Sun", 0],
  ["Mon", 1],
  ["Tue", 2],
  ["Wed", 3],
  ["Thu", 4],
  ["Fri", 5],
  ["Sat", 6],
] as const;

function DowSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (dow: number) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="h-11 w-full rounded-lg bg-bg px-3 text-base"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {WEEKDAYS.map(([name, dow]) => (
          <option key={dow} value={dow}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}

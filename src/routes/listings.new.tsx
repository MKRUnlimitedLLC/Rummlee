import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ModePicks } from "@/components/mode-picks";
import { PhotoInput } from "@/components/photo-input";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useAuthGate } from "@/components/guest-gate";
import { CATEGORIES, CONDITIONS, HAULS, MIN_PRICE_CENTS, NEIGHBORHOODS, PASTE_CAP, SALE_KINDS } from "@/lib/rummlee/constants";
import {
  blankLine,
  clearDraft,
  lastCity,
  loadDraft,
  parsePasteList,
  rememberAfterLogin,
  saveDraft,
  takeAfterLogin,
  type DraftLine,
  type ListingDraft,
} from "@/lib/rummlee/draft";
import { errMessage } from "@/lib/rummlee/errors";
import { cityOf, nextSaturdayIso, splitModes } from "@/lib/rummlee/format";
import { addListing, bootstrapPublic, createSale, getMe } from "@/lib/rummlee/server";
import type { HandoffMode } from "@/lib/rummlee/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/listings/new")({
  component: NewListingPage,
});

function freshDraft(): ListingDraft {
  const fm = lastCity() === "Fargo–Moorhead";
  return {
    kind: "moving",
    neighborhood: fm ? "West Fargo, Fargo–Moorhead" : NEIGHBORHOODS[0],
    modes: ["official"],
    handoffSpotId: "",
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

  useEffect(() => {
    const savedDraft = loadDraft();
    if (savedDraft?.lines?.length) setDraft(savedDraft);
  }, []);

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
      const nextLines = parsed.map((row) =>
        blankLine({
          title: row.title,
          price: row.price,
          category: current.kind === "moving" ? "furniture" : "other",
          haul: current.kind === "moving" ? "two" : "one",
        }),
      );
      return { ...current, lines: empty ? nextLines : [...current.lines, ...nextLines].slice(0, PASTE_CAP) };
    });
    setPaste("");
    toast.success(parsed.length === 1 ? "Added 1 item." : `Added ${parsed.length} items.`);
  }

  const publish = useMutation({
    mutationFn: async () => {
      const ready = draft.lines.filter((line) => line.title.trim() && line.photoUrl && dollarsToCents(line.price) >= MIN_PRICE_CENTS);
      if (!ready.length) throw new Error("Each item needs a photo and an asking price of at least $5.");
      const modes = splitModes(draft.modes.join(","));
      const live = meQ.data?.sales.filter((sale) => sale.status === "live" && sale.neighborhood === draft.neighborhood) ?? [];
      let saleId = live[0]?.id;
      if (!saleId) {
        const kind = SALE_KINDS.find((item) => item.id === draft.kind);
        const created = await createSale({
          data: {
            name: `${draft.neighborhood.split(",")[0]} ${kind?.label ?? "Sale"}`.slice(0, 80),
            kind: draft.kind,
            neighborhood: draft.neighborhood,
            startsOn: nextSaturdayIso(),
            endsOn: nextSaturdayIso(),
            handoffModes: modes,
            handoffSpotId: draft.handoffSpotId || null,
          },
        });
        saleId = created.id;
      }
      const ids: string[] = [];
      for (const line of ready) {
        const priceCents = dollarsToCents(line.price);
        const created = await addListing({
          data: {
            saleId,
            title: line.title.trim(),
            description: line.description.trim(),
            priceCents,
            buyNowCents: priceCents,
            category: line.category,
            condition: line.condition,
            haul: line.haul,
            photoUrl: line.photoUrl,
            handoffModes: modes,
          },
        });
        ids.push(created.id);
      }
      return { saleId, ids };
    },
    onSuccess: ({ saleId, ids }) => {
      clearDraft();
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success(ids.length === 1 ? "Published & visible on Browse." : `Published ${ids.length} items. Visible on Browse.`);
      if (ids.length === 1) void navigate({ to: "/listings/$id", params: { id: ids[0] } });
      else void navigate({ to: "/sales/$id", params: { id: saleId } });
    },
    onError: (error) => toast.error(errMessage(error)),
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

  return (
    <main className="mx-auto max-w-lg py-6">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">List it</h1>
      <p className="mt-1 text-muted">
        Photo, asking price, and a partner store. A public place is backup. A home address never goes on the listing.
      </p>
      <p className="mt-2 text-sm text-muted">
        <Link to="/sell" className="font-medium text-primary-ink">
          How handoff works
        </Link>
      </p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!user) onSaveDraft();
          else publish.mutate();
        }}
      >
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

        <div>
          <Label htmlFor="hood">Neighborhood</Label>
          <select
            id="hood"
            className="h-11 w-full rounded-lg bg-surface px-3 text-[15px] shadow-[0_0_0_1px_rgba(28,25,21,0.1)]"
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
          <Label htmlFor="spot">Partner store</Label>
          <select
            id="spot"
            className="h-11 w-full rounded-lg bg-surface px-3 text-[15px] shadow-[0_0_0_1px_rgba(22,20,18,0.1)]"
            value={draft.handoffSpotId}
            onChange={(event) => setDraft((current) => ({ ...current, handoffSpotId: event.target.value }))}
          >
            <option value="">Closest official partner</option>
            {hoodSpots.some((spot) => spot.kind === "partner") ? (
              <optgroup label="Partner stores">
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
              <optgroup label="Public places">
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
          <p className="mt-1 text-sm text-muted">Partner store first. Public place if you need it. Never a home address.</p>
        </div>

        <ModePicks
          value={draft.modes}
          onChange={(modes) => {
            setSaved(false);
            setDraft((current) => ({ ...current, modes }));
          }}
        />

        <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
          <Label htmlFor="paste">Paste a list</Label>
          <p className="mt-1 text-sm text-muted">Moving or clearout. One item per line, price at the end. Up to {PASTE_CAP}.</p>
          <Textarea
            id="paste"
            className="mt-2"
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            placeholder={"Cream sofa, 90\nWhite desk 120\nMicrowave — 35"}
          />
          <button type="button" className="mt-2 text-sm font-medium text-primary-ink" onClick={applyPaste}>
            Add these rows
          </button>
        </div>

        {draft.lines.map((line, index) => (
          <fieldset key={line.id} className="space-y-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
            <legend className="px-1 text-sm font-medium">Item {index + 1}</legend>
            <PhotoInput value={line.photoUrl} onChange={(photoUrl) => updateLine(line.id, { photoUrl })} />
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
            </div>
            <div>
              <Label htmlFor={`desc-${line.id}`}>Note</Label>
              <Textarea
                id={`desc-${line.id}`}
                value={line.description}
                onChange={(event) => updateLine(line.id, { description: event.target.value })}
                placeholder="One cushion is a little sat."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <select
                  className="h-11 w-full rounded-lg bg-bg px-3 text-[15px]"
                  value={line.category}
                  onChange={(event) => updateLine(line.id, { category: event.target.value })}
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
                  className="h-11 w-full rounded-lg bg-bg px-3 text-[15px]"
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
            {draft.lines.length > 1 ? (
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

        <button
          type="button"
          className="text-sm font-medium text-primary-ink"
          onClick={() => setDraft((current) => ({ ...current, lines: [...current.lines, blankLine()].slice(0, PASTE_CAP) }))}
        >
          Add another item
        </button>

        {showLoading ? (
          <Button type="button" className="w-full" disabled>
            Checking your account…
          </Button>
        ) : user ? (
          <Button type="submit" className="w-full" disabled={publish.isPending || meQ.isPending}>
            {publish.isPending ? "Publishing…" : "Publish"}
          </Button>
        ) : (
          <Button type="submit" className="w-full">
            Save draft
          </Button>
        )}
        <p className="text-center text-sm text-muted">Free to list. Fee 10% when it sells. Premium is 5%.</p>
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

function dollarsToCents(price: string) {
  const amount = Number(price);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

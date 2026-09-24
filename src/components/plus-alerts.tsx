import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { errMessage } from "@/lib/rummlee/errors";
import { CATEGORIES, CITIES, HAULS } from "@/lib/rummlee/constants";
import { getPlusAlert, savePlusAlert, type PlusAlert } from "@/lib/rummlee/alerts";
import { cn } from "@/lib/utils";

export function PlusAlerts({ plus }: { plus: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["plus-alert"], queryFn: () => getPlusAlert() });
  const [form, setForm] = useState<PlusAlert | null>(null);
  useEffect(() => {
    if (q.data && !form) setForm(q.data.alert);
  }, [q.data, form]);

  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("Alerts are still loading.");
      return savePlusAlert({
        data: {
          ...form,
          keyword: form.keyword,
          sizeLabel: form.sizeLabel,
          maxPriceCents: form.maxPriceCents,
          spotId: form.spotId,
          city: form.city,
        },
      });
    },
    onSuccess: () => {
      toast.success(form?.enabled ? "Plus alerts are on." : "Plus alerts are off.");
      void qc.invalidateQueries({ queryKey: ["plus-alert"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  if (!plus) {
    return (
      <section className="mt-6 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
        <p className="font-medium">Plus alerts</p>
        <p className="mt-1 text-sm text-muted">
          Included with Plus and +++. Pick a category, an official store, or in-person sales in your city. Nothing is sent until you do.
        </p>
      </section>
    );
  }

  if (!form || !q.data) {
    return (
      <section className="mt-6 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
        <p className="font-medium">Plus alerts</p>
        <p className="mt-1 text-sm text-muted">Loading.</p>
      </section>
    );
  }

  const spots = q.data.spots.filter((spot) => !form.city || spot.area.includes(form.city));
  const set = (patch: Partial<PlusAlert>) => setForm({ ...form, ...patch });
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);

  return (
    <section className="mt-6 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
      <p className="font-medium">Plus alerts</p>
      <p className="mt-1 text-sm text-muted">
        New items that match every filter you turn on. In-person sales notify once per sale, not once per item. The alert shows the title, price, city, and handoff. Never a street or a legal name. Morning digest is the default. Right away waits overnight, 9pm to 8am Central.
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        Send alerts
      </label>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.instant} onChange={(e) => set({ instant: e.target.checked })} />
        Right away, instead of the morning digest
      </label>
      <div className="mt-3">
        <Label htmlFor="alert-city">City</Label>
        <select
          id="alert-city"
          className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
          value={form.city ?? ""}
          onChange={(e) => set({ city: e.target.value || null, spotId: null })}
        >
          <option value="">Any city</option>
          {CITIES.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-3 text-sm font-medium">Categories</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <Chip key={cat.id} on={form.categories.includes(cat.id)} onClick={() => set({ categories: toggle(form.categories, cat.id) })}>
            {cat.label}
          </Chip>
        ))}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.officialOn} onChange={(e) => set({ officialOn: e.target.checked })} />
        Official store handoff
      </label>
      {form.officialOn ? (
        <select
          className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
          value={form.spotId ?? ""}
          onChange={(e) => set({ spotId: e.target.value || null })}
        >
          <option value="">Any official store{form.city ? ` in ${form.city}` : ""}</option>
          {spots.map((spot) => (
            <option key={spot.id} value={spot.id}>
              {spot.name}
            </option>
          ))}
        </select>
      ) : null}
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.inPersonOn} onChange={(e) => set({ inPersonOn: e.target.checked })} />
        Upcoming in-person sales in this city
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="alert-word">Keyword</Label>
          <Input id="alert-word" value={form.keyword} onChange={(e) => set({ keyword: e.target.value })} placeholder="Mixer, crib, sectional" />
        </div>
        <div>
          <Label htmlFor="alert-max">Max price</Label>
          <Input
            id="alert-max"
            inputMode="decimal"
            value={form.maxPriceCents == null ? "" : String(form.maxPriceCents / 100)}
            placeholder="No max"
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (!raw) set({ maxPriceCents: null });
              else {
                const cents = Math.round(Number(raw) * 100);
                set({ maxPriceCents: Number.isFinite(cents) ? cents : form.maxPriceCents });
              }
            }}
          />
        </div>
      </div>
      <p className="mt-3 text-sm font-medium">Haul</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {HAULS.map((haul) => (
          <Chip key={haul.id} on={form.hauls.includes(haul.id)} onClick={() => set({ hauls: toggle(form.hauls, haul.id) as PlusAlert["hauls"] })}>
            {haul.label}
          </Chip>
        ))}
      </div>
      <div className="mt-3">
        <Label htmlFor="alert-size">Kids or clothing size</Label>
        <Input id="alert-size" value={form.sizeLabel} onChange={(e) => set({ sizeLabel: e.target.value })} placeholder="2T, M" />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.counterOnly} onChange={(e) => set({ counterOnly: e.target.checked })} />
        Official counter only. Boxed, 50 lb or under.
      </label>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.weekendOnly} onChange={(e) => set({ weekendOnly: e.target.checked })} />
        Live in-person hours in the next 7 days
      </label>
      <Button className="mt-4" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "Saving…" : "Save alerts"}
      </Button>
    </section>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm",
        on ? "bg-primary-ink text-primary-fg" : "bg-bg text-fg",
      )}
    >
      {children}
    </button>
  );
}

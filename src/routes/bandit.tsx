import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { BANDIT_UPDATED, MODELS, TRICIA, briefForFriend, type LeadBrief } from "@/lib/rummlee/bandit";

const SAVED = "rummlee.bandit.leads";

const DESK = [
  { href: "/bandit/rummlee-tricia.html", label: "Deck: Rummlee for Tricia" },
  { href: "/bandit/tricia-rummlee-briefing.html", label: "Deck: briefing" },
  { href: "/bandit/TRICIA-GROK-COMPANION.txt", label: "Grok companion" },
  { href: "/bandit/TRICIA-RUMMLEE-COMPANION.txt", label: "Rummlee companion" },
] as const;

type SavedLead = { name: string; city: string };

export const Route = createFileRoute("/bandit")({
  head: () => ({
    meta: [
      { title: "Market lead briefing" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BanditPage,
});

function BanditPage() {
  const [saved, setSaved] = useState<SavedLead[]>([]);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [pick, setPick] = useState("tricia");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED);
      if (raw) setSaved(JSON.parse(raw) as SavedLead[]);
    } catch {
      /* ignore a bad local note */
    }
  }, []);

  const friends = saved.map((s) => briefForFriend(s.name, s.city));
  const all = [TRICIA, ...MODELS, ...friends];
  const brief = all.find((b) => b.id === pick) ?? TRICIA;

  function addFriend() {
    const next = { name: name.trim(), city: city.trim() };
    if (!next.name || !next.city) return;
    const list = [...saved.filter((s) => s.name.toLowerCase() !== next.name.toLowerCase()), next];
    setSaved(list);
    localStorage.setItem(SAVED, JSON.stringify(list));
    setPick(briefForFriend(next.name, next.city).id);
    setName("");
    setCity("");
  }

  return (
    <main className="py-6">
      <p className="text-sm font-medium text-primary-ink">Private briefing. Not linked from the app.</p>
      <h1 className="mt-1 font-display text-3xl font-medium tracking-[-0.03em]">Market leads</h1>
      <p className="mt-2 max-w-2xl text-pretty text-muted">
        Tricia assigns the city. Diane, Erin, and Kirstin are the models. Updated {BANDIT_UPDATED}. Not an offer.
      </p>
      <nav className="mt-6 max-w-2xl" aria-label="Private desk">
        <h2 className="font-display text-xl font-medium">For Tricia</h2>
        <p className="mt-1 text-sm text-muted">Private. Open these from here. They are not in the app menu.</p>
        <ul className="mt-3 space-y-1">
          {DESK.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                rel="nofollow"
                className="inline-flex min-h-11 items-center font-medium text-primary-ink underline-offset-4 hover:underline"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Briefings">
        {all.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={b.id === brief.id}
            className={
              b.id === brief.id
                ? "shrink-0 rounded-full bg-fg px-4 py-2 text-sm font-medium text-primary-fg"
                : "shrink-0 rounded-full bg-bg-warm px-4 py-2 text-sm font-medium text-fg"
            }
            onClick={() => setPick(b.id)}
          >
            {b.name}
          </button>
        ))}
      </div>
      <Brief brief={brief} />
      <section className="mt-10 max-w-lg rounded-2xl border border-border p-4">
        <h2 className="font-display text-xl font-medium">A friend Tricia is bringing on</h2>
        <p className="mt-1 text-sm text-muted">Same briefing as the models. The city is the part Tricia assigns. Saved on this phone only.</p>
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="lead-name">Name</Label>
            <Input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="lead-city">City area</Label>
            <Input id="lead-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City Tricia assigns" />
          </div>
          <Button type="button" onClick={addFriend} disabled={!name.trim() || !city.trim()}>
            Make the briefing
          </Button>
        </div>
      </section>
    </main>
  );
}

function Brief({ brief }: { brief: LeadBrief }) {
  return (
    <article className="mt-6 max-w-2xl" aria-live="polite">
      <p className="text-sm font-medium text-primary-ink">{brief.kicker}</p>
      <h2 className="font-display text-2xl font-medium tracking-[-0.02em]">{brief.name}</h2>
      <p className="text-muted">{brief.city}</p>
      <div className="mt-6 space-y-6 text-base leading-relaxed">
        {brief.sections.map((section) => (
          <section key={section.title}>
            <h3 className="font-display text-xl font-medium">{section.title}</h3>
            <div className="mt-2 space-y-3">
              {section.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

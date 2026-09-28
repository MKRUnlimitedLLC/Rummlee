import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { getBanditDesk, unlockBandit } from "@/lib/rummlee/bandit-api";
import { briefForFriend, type LeadBrief } from "@/lib/rummlee/bandit-types";

const SAVED = "rummlee.bandit.leads";

type SavedLead = { name: string; city: string };

export const Route = createFileRoute("/bandit")({
  head: () => ({
    meta: [
      { title: "Rummlee" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: () => getBanditDesk(),
  component: BanditPage,
});

function BanditPage() {
  const desk = Route.useLoaderData();
  if (!desk.open) return <Lock />;
  return (
    <Desk
      updated={desk.updated}
      tricia={desk.tricia}
      models={desk.models}
      shared={desk.shared}
      links={desk.desk}
    />
  );
}

function Lock() {
  const [code, setCode] = useState("");
  const [wrong, setWrong] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setWrong(false);
    try {
      const res = await unlockBandit({ data: { code } });
      if (!res.ok) {
        setWrong(true);
        setPending(false);
        return;
      }
      window.location.assign("/bandit");
    } catch {
      setWrong(true);
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center py-10 text-center">
      <img src="/brand/mark.png" alt="" width={160} height={160} className="h-40 w-40" />
      <h1 className="mt-4 font-display text-3xl font-medium tracking-[-0.03em]">Bandit</h1>
      <p className="mt-2 max-w-xs text-muted">A code opens the briefing.</p>
      <form
        className="mt-6 w-full max-w-xs space-y-3 text-left"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <Label htmlFor="bandit-code">Code</Label>
          <Input
            id="bandit-code"
            type="password"
            autoComplete="current-password"
            enterKeyHint="go"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        {wrong ? <p className="text-sm text-primary-ink">That code is not right.</p> : null}
        <Button type="submit" className="w-full" disabled={pending || code.trim().length === 0}>
          Open
        </Button>
      </form>
    </main>
  );
}

function Desk({
  updated,
  tricia,
  models,
  shared,
  links,
}: {
  updated: string;
  tricia: LeadBrief;
  models: LeadBrief[];
  shared: LeadBrief["sections"];
  links: { href: string; label: string }[];
}) {
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
  const pattern = models[0];
  const friends = pattern ? saved.map((s) => briefForFriend(pattern, s.name, s.city)) : [];
  const all = [tricia, ...models, ...friends];
  const brief = all.find((b) => b.id === pick) ?? tricia;

  function addFriend() {
    const next = { name: name.trim(), city: city.trim() };
    if (!next.name || !next.city || !pattern) return;
    const list = [...saved.filter((s) => s.name.toLowerCase() !== next.name.toLowerCase()), next];
    setSaved(list);
    localStorage.setItem(SAVED, JSON.stringify(list));
    setPick(briefForFriend(pattern, next.name, next.city).id);
    setName("");
    setCity("");
  }

  return (
    <main className="py-6">
      <p className="text-sm font-medium text-primary-ink">Private briefing. Not linked from the app.</p>
      <h1 className="mt-1 font-display text-3xl font-medium tracking-[-0.03em]">Market leads</h1>
      <p className="mt-2 max-w-2xl text-pretty text-muted">Updated {updated}. Not an offer.</p>
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
      <div className="mt-8 max-w-2xl space-y-6 text-base leading-relaxed">
        {shared.map((section) => (
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
      <section className="mt-10 max-w-lg rounded-2xl border border-border p-4">
        <h2 className="font-display text-xl font-medium">A new friend</h2>
        <p className="mt-1 text-sm text-muted">Same briefing as the models. You assign the city. Saved on this phone only.</p>
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="lead-name">Name</Label>
            <Input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="lead-city">City area</Label>
            <Input id="lead-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City area" />
          </div>
          <Button type="button" onClick={addFriend} disabled={!name.trim() || !city.trim()}>
            Make the briefing
          </Button>
        </div>
      </section>
      <nav className="mt-10 max-w-2xl" aria-label="Private desk">
        <h2 className="font-display text-xl font-medium">Decks</h2>
        <ul className="mt-2 space-y-1">
          {links.map((item) => (
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

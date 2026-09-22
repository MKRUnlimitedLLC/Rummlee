import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, EyeOff, Store } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bootstrapPublic } from "@/lib/rummlee/server";
import { CATEGORIES, CITIES, HOLD_LINE } from "@/lib/rummlee/constants";
import { rememberCity } from "@/lib/rummlee/draft";
import { cityOf } from "@/lib/rummlee/format";
import type { HandoffSpot } from "@/lib/rummlee/types";
import { cn } from "@/lib/utils";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({
  loader: () => bootstrapPublic(),
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  const { data } = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => bootstrapPublic(),
    initialData: initial,
  });
  const { user, isPending } = useCurrentUserState();
  const signedIn = isPending ? Boolean(data?.signedIn) : Boolean(user);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [city, setCity] = useState<string>("all");

  const listings = useMemo(() => {
    if (!data?.listings) return [];
    const query = q.trim().toLowerCase();
    const filtered = data.listings.filter((l) => {
      if (cat !== "all" && l.category !== cat) return false;
      if (city !== "all" && cityOf(l.neighborhood) !== city) return false;
      if (!query) return true;
      return (
        l.title.toLowerCase().includes(query) ||
        l.description.toLowerCase().includes(query) ||
        l.saleName.toLowerCase().includes(query) ||
        l.neighborhood.toLowerCase().includes(query)
      );
    });
    if (city !== "Fargo–Moorhead") return filtered;
    const contractor = (l: (typeof filtered)[number]) =>
      l.category === "outdoor" || l.haul === "truck" ? 0 : 1;
    return [...filtered].sort((a, b) => contractor(a) - contractor(b));
  }, [data?.listings, q, cat, city]);

  if (!data?.listings) {
    return (
      <main className="py-16 text-center">
        <p className="font-display text-2xl font-semibold tracking-[-0.03em]">The good stuff, before Saturday.</p>
        <p className="mt-2 text-sm text-muted">Listings are loading.</p>
      </main>
    );
  }

  return (
    <main className="pt-5">
      {signedIn ? <SignedHero /> : <GuestHero />}

      <div className="mt-6 space-y-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search sofas, mixers, linen…"
          aria-label="Search listings"
        />
        <div className="-mx-4 flex flex-wrap gap-2 px-4 pb-1 md:mx-0">
          <Chip active={cat === "all"} onClick={() => setCat("all")}>
            All
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
              {c.label}
            </Chip>
          ))}
        </div>
        <div className="-mx-4 flex flex-wrap gap-2 px-4 pb-1 md:mx-0">
          <Chip
            active={city === "all"}
            onClick={() => {
              setCity("all");
              rememberCity("all");
            }}
          >
            Nationwide
          </Chip>
          {CITIES.map((c) => (
            <Chip
              key={c}
              active={city === c}
              onClick={() => {
                setCity(c);
                rememberCity(c);
              }}
            >
              {c}
            </Chip>
          ))}
        </div>
      </div>

      <section id="finds" className="mt-6 scroll-mt-20">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">This weekend</h2>
            <p className="text-sm text-muted">Same listings as Browse — this weekend first.</p>
          </div>
          <Link to="/sales" className="shrink-0 text-sm font-medium text-primary-ink">
            All sales
          </Link>
        </div>
        {listings.length === 0 ? (
          <p className="rounded-2xl bg-surface px-4 py-10 text-center text-muted shadow-[var(--shadow-card)]">
            Nothing in that city yet. Try another filter — or list yours.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} premium={data.buyerPremium} />
            ))}
          </div>
        )}
      </section>

      <HandoffStrip spots={data.spots} city={city} />
    </main>
  );
}

function GuestHero() {
  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)] sm:rounded-[28px]">
      <div className="relative aspect-[16/9] max-h-56 w-full overflow-hidden sm:max-h-72">
        <img src="/listings/hero-sale.jpg" alt="" className="size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-fg/80 via-fg/20 to-transparent" />
        <p className="absolute bottom-3 left-4 right-4 font-display text-2xl font-semibold leading-tight tracking-[-0.04em] text-primary-fg sm:text-3xl">
          The good stuff, before Saturday.
        </p>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-pretty text-muted">
          Furniture, kitchen, closet, and kids — from neighbors in the city and the suburbs. Offer this week. Meet at a
          handoff location, never a home address.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Perk icon={CalendarDays} title="Offers before Saturday" body="Browse while the closet is still being edited. Lock it in before the weekend." />
          <Perk icon={EyeOff} title="A handle, not your name" body="Neighbors see @linen_lark. Email, legal name, and home stay off the listing." />
          <Perk icon={Store} title="Handoff locations" body="Official store, public place, or in person — the seller chooses which to offer. Never a home address." />
        </div>
        <p className="inline-flex rounded-full bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary-ink">
          {HOLD_LINE}
        </p>
        <Button asChild className="w-full">
          <a href="#finds">Browse this weekend</a>
        </Button>
        <p className="text-center text-sm text-muted">
          <Link to="/listings/new" className="font-medium text-primary-ink">
            Sell
          </Link>
          <span className="mx-2">·</span>
          <Link to="/sales" className="font-medium text-fg">
            This weekend
          </Link>
          <span className="mx-2">·</span>
          <Link to="/login" className="font-medium text-fg">
            Sign in
          </Link>
        </p>
        <p className="text-center text-sm text-muted">
          <Link to="/fees" className="font-medium text-primary-ink">
            Fees
          </Link>
        </p>
        <p className="text-center text-xs text-subtle">
          <Link to="/privacy" className="underline-offset-4 hover:underline">
            Privacy
          </Link>
          <span className="mx-2">·</span>
          <Link to="/terms" className="underline-offset-4 hover:underline">
            Terms
          </Link>
          <span className="mx-2">·</span>
          <Link to="/support" className="underline-offset-4 hover:underline">
            Support
          </Link>
        </p>
      </div>
    </section>
  );
}

function SignedHero() {
  return (
    <section className="rounded-2xl bg-primary-soft px-5 py-4">
      <p className="flex items-center gap-1.5 text-sm font-medium text-primary-ink">
        <CalendarDays className="size-4" strokeWidth={1.8} />
        This weekend nearby
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em]">The good stuff is already listed</h1>
      <p className="mt-1 text-sm text-muted">Offer now. Meet at a handoff location — never a home address.</p>
      <p className="mt-3 inline-flex rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-primary-ink">
        {HOLD_LINE}
      </p>
    </section>
  );
}

function HandoffStrip({
  spots,
  city,
}: {
  spots: HandoffSpot[];
  city: string;
}) {
  const partners = spots.filter((s) => s.kind === "partner" && (city === "all" || s.area.includes(city))).slice(0, 8);
  if (partners.length === 0) return null;
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">Handoff locations</h2>
        <Link to="/sales" className="text-sm font-medium text-primary-ink">
          All sales
        </Link>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {partners.map((sp) => (
          <Link
            key={sp.id}
            to="/sales"
            className="w-56 shrink-0 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-primary-ink">Official store handoff</p>
            <p className="mt-1 font-medium leading-snug">{sp.name}</p>
            <p className="mt-1 text-xs text-muted">{sp.area}</p>
            <p className="mt-1 text-xs text-subtle">{sp.hint}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Perk({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Store;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl bg-bg px-3.5 py-3">
      <Icon className="mb-2 size-4 text-primary-ink" strokeWidth={1.8} />
      <p className="text-sm font-medium text-fg">{title}</p>
      <p className="mt-0.5 text-sm leading-snug text-muted">{body}</p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors duration-150",
        active ? "bg-fg text-primary-fg" : "bg-surface text-muted shadow-[0_0_0_1px_rgba(22,20,18,0.08)]",
      )}
    >
      {children}
    </button>
  );
}

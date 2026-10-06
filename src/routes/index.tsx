import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, EyeOff, Store } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { PatentPending } from "@/components/patent-pending";
import { WaitlistForm } from "@/components/launch-forms";
import { Input } from "@/components/ui/input";
import { bootstrapPublic } from "@/lib/rummlee/server";
import { CATEGORIES, CITIES, HAULS, HOLD_LINE } from "@/lib/rummlee/constants";
import { lastCity, rememberCity } from "@/lib/rummlee/draft";
import { cityOf } from "@/lib/rummlee/format";
import { isSamplePartnerSpot, publicSpotHint, sampleStoreEyebrow } from "@/lib/rummlee/sample-store";
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
  const [city, setCity] = useState<string | null>(null);
  const cityTouched = useRef(false);
  useEffect(() => {
    if (cityTouched.current) return;
    const saved = lastCity();
    setCity(saved && saved !== "all" ? saved : "all");
  }, []);
  const [haul, setHaul] = useState<string>("all");
  const [size, setSize] = useState<string>("all");
  const [storeOnly, setStoreOnly] = useState(false);
  const [lotOk, setLotOk] = useState(false);

  const listings = useMemo(() => {
    if (!data?.listings) return [];
    const query = q.trim().toLowerCase();
    const filtered = data.listings.filter((l) => {
      if (cat !== "all" && l.category !== cat) return false;
      if (city && city !== "all" && cityOf(l.neighborhood) !== city) return false;
      if (haul !== "all" && l.haul !== haul) return false;
      if (size !== "all" && (l.sizeLabel ?? "") !== size) return false;
      if (storeOnly && !l.handoffModes.includes("official")) return false;
      if (lotOk && !l.handoffModes.includes("public")) return false;
      if (!query) return true;
      return (
        l.title.toLowerCase().includes(query) ||
        l.description.toLowerCase().includes(query) ||
        (l.sizeLabel ?? "").toLowerCase().includes(query) ||
        l.saleName.toLowerCase().includes(query) ||
        l.neighborhood.toLowerCase().includes(query)
      );
    });
    if (city !== "Fargo–Moorhead") return filtered;
    const contractor = (l: (typeof filtered)[number]) =>
      l.category === "outdoor" || l.haul === "truck" ? 0 : 1;
    return [...filtered].sort((a, b) => contractor(a) - contractor(b));
  }, [data?.listings, q, cat, city, haul, size, storeOnly, lotOk]);

  const sizeOptions = useMemo(() => {
    if (!data?.listings) return [];
    const pool = data.listings.filter((l) => {
      if (cat !== "all" && l.category !== cat) return false;
      return Boolean(l.sizeLabel) && (cat === "all" ? l.category === "kids" || l.category === "clothing" : true);
    });
    return [...new Set(pool.map((l) => l.sizeLabel as string))];
  }, [data?.listings, cat]);

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
      <LaunchChoices />

      <div className="mt-6 space-y-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search sofas, mixers, linen…"
          aria-label="Search listings"
        />
        <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-bg px-4 py-2">
        <div className="-mx-4 flex flex-wrap gap-2 px-4 pb-1 md:mx-0">
          <Chip active={cat === "all"} onClick={() => { setCat("all"); setSize("all"); }}>
            All
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              active={cat === c.id}
              onClick={() => {
                setCat(c.id);
                setSize("all");
              }}
            >
              {c.label}
            </Chip>
          ))}
        </div>
        <div className="-mx-4 flex flex-wrap gap-2 px-4 pb-1 md:mx-0">
          <Chip
            active={city === "all"}
            onClick={() => {
              cityTouched.current = true;
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
                cityTouched.current = true;
                setCity(c);
                rememberCity(c);
              }}
            >
              {c}
            </Chip>
          ))}
        </div>
        <div className="-mx-4 flex flex-wrap gap-2 px-4 pb-1 md:mx-0">
          <Chip active={haul === "all"} onClick={() => setHaul("all")}>
            Any haul
          </Chip>
          {HAULS.map((h) => (
            <Chip key={h.id} active={haul === h.id} onClick={() => setHaul(h.id)}>
              {h.label}
            </Chip>
          ))}
        </div>
        <div className="-mx-4 flex flex-wrap gap-2 px-4 pb-1 md:mx-0">
          <Chip active={storeOnly} onClick={() => setStoreOnly((v) => !v)}>
            Official store only
          </Chip>
          <Chip active={lotOk} onClick={() => setLotOk((v) => !v)}>
            Parking lot
          </Chip>
        </div>
        {sizeOptions.length > 0 ? (
          <div className="-mx-4 flex flex-wrap gap-2 px-4 pb-1 md:mx-0">
            <Chip active={size === "all"} onClick={() => setSize("all")}>
              Any size
            </Chip>
            {sizeOptions.map((label) => (
              <Chip key={label} active={size === label} onClick={() => setSize(label)}>
                {label}
              </Chip>
            ))}
          </div>
        ) : null}
        </div>
      </div>

      <section id="finds" className="mt-6 scroll-mt-20">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">Sample listings</h2>
            <p className="text-sm text-muted">Not for sale. Nothing is live until a handoff location is open.</p>
          </div>
          <Link to="/sales" className="shrink-0 text-sm font-medium text-primary-ink">
            All sales
          </Link>
        </div>
        {listings.length === 0 ? (
          <div className="rounded-2xl bg-surface px-4 py-10 text-center shadow-[var(--shadow-card)]">
            <p className="text-muted">
              {!city || city === "all" ? "Nothing matched those filters." : `Nothing in ${city} this weekend.`}
            </p>
            {city && city !== "all" ? (
              <button
                type="button"
                className="mt-3 text-sm font-medium text-primary-ink"
                onClick={() => {
                  cityTouched.current = true;
                  setCity("all");
                  rememberCity("all");
                }}
              >
                Show every city
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} premium={data.buyerPremium} />
            ))}
          </div>
        )}
      </section>

      <HandoffStrip spots={data.spots} city={city ?? "all"} />
    </main>
  );
}

function GuestHero() {
  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)] sm:rounded-[28px]">
      <div className="relative aspect-[16/9] max-h-56 w-full overflow-hidden sm:max-h-72">
        <img src="/listings/hero-sale.jpg" alt="Neighbors browsing a weekend sale" className="size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-fg/80 via-fg/20 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-3xl">
            The good stuff, before Saturday.
          </h1>
          <p className="mt-1 text-sm font-medium text-white">Patent pending</p>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-pretty text-muted">
          Rummlee isn’t open yet. Sign up to be first to know about updates and the launch. Pickup will be at an
          official handoff location, not a stranger’s house. Nothing ships.
        </p>
        <p className="text-sm">
          <Link to="/films" className="font-medium text-primary-ink underline-offset-4 hover:underline">
            Six short films
          </Link>
        </p>
        <PatentPending className="text-sm text-muted" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Perk icon={CalendarDays} title="First to know" body="Updates and the launch. One email. We don’t sell the address." />
          <Perk icon={EyeOff} title="A handle, not your name" body="Neighbors see a handle. Email, legal name, and home stay off the listing." />
          <Perk icon={Store} title="Official handoff location" body="A store holds the package. A public place is the backup. Private handoff only if you both want it." />
        </div>
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
          <span className="mx-2">·</span>
          <Link to="/fees" className="underline-offset-4 hover:underline">
            Fees
          </Link>
          <span className="mx-2">·</span>
          <Link to="/investors" className="underline-offset-4 hover:underline">
            Investors
          </Link>
          <span className="mx-2">·</span>
          <Link to="/about" className="underline-offset-4 hover:underline">
            About
          </Link>
          <span className="mx-2">·</span>
          <Link to="/films" className="underline-offset-4 hover:underline">
            Films
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
        Samples only
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em]">Nothing is for sale yet</h1>
      <p className="mt-1 text-sm font-medium text-primary-ink">Patent pending</p>
      <p className="mt-1 text-sm text-muted">These listings are samples. Pickup will be at a handoff location. Nothing ships.</p>
      <p className="mt-3 inline-flex rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-primary-ink">
        {HOLD_LINE}
      </p>
      <p className="mt-3 text-sm">
        <Link to="/films" className="font-medium text-primary-ink underline-offset-4 hover:underline">
          Six short films
        </Link>
      </p>
    </section>
  );
}

function LaunchChoices() {
  const [joined, setJoined] = useState<string | null>(null);
  return (
    <section id="waitlist" className="mt-6 grid scroll-mt-24 gap-4 sm:grid-cols-2">
      <div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">When real items launch</h2>
        <p className="mt-1 text-sm text-muted">
          Leave an email. We’ll write when a city opens for real listings. Nothing is for sale yet. We don’t sell the address.
        </p>
        {joined ? (
          <p className="mt-3 rounded-2xl bg-primary-soft px-4 py-3 text-sm text-primary-ink">{joined}</p>
        ) : (
          <WaitlistForm idPrefix="home" onSuccess={setJoined} />
        )}
      </div>
      <div className="flex flex-col rounded-2xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">Be a handoff location</h2>
        <p className="mt-1 text-sm text-muted">
          A shop that can hold a paid item for pickup. The application is a short form. Asking is free. It is not a signed store.
        </p>
        <Link
          to="/handoff"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-fg"
        >
          Apply to be a handoff location
        </Link>
      </div>
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
  const allSamples = partners.every((sp) => isSamplePartnerSpot(sp.id));
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">Handoff locations</h2>
          {allSamples ? (
            <p className="text-sm text-muted">Sample names. No store has signed.</p>
          ) : null}
        </div>
        <Link to="/sales" className="text-sm font-medium text-primary-ink">
          All sales
        </Link>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {partners.map((sp) => {
          const sample = isSamplePartnerSpot(sp.id);
          return (
            <Link
              key={sp.id}
              to="/sales"
              className="w-56 shrink-0 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-primary-ink">{sampleStoreEyebrow(sp.id)}</p>
              <p className="mt-1 font-medium leading-snug">{sp.name}</p>
              <p className="mt-1 text-xs text-muted">{sp.area}</p>
              {sample ? <p className="mt-1 text-xs font-medium text-fg">Not a signed store.</p> : null}
              <p className="mt-1 text-xs text-subtle">{publicSpotHint(sp.id, sp.hint)}</p>
            </Link>
          );
        })}
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
        active ? "bg-fg text-primary-fg" : "bg-surface text-muted shadow-[0_0_0_1px_var(--color-border)]",
      )}
    >
      {children}
    </button>
  );
}

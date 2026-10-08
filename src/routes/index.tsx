import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, EyeOff, Store } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { PatentPending } from "@/components/patent-pending";
import { WaitlistForm } from "@/components/launch-forms";
import { Input } from "@/components/ui/input";
import { bootstrapPublic } from "@/lib/rummlee/server";
import { CATEGORIES, HAULS, HOLD_LINE } from "@/lib/rummlee/constants";
import { lastCity, rememberCity } from "@/lib/rummlee/draft";
import { cityOf } from "@/lib/rummlee/format";
import { cityForQuery, isListedCity, listingInPlace, nearestSampleCity, placeSuggestions } from "@/lib/rummlee/places";
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
  const [placeQuery, setPlaceQuery] = useState("");
  const [nearCity, setNearCity] = useState<string | null>(null);
  const [locNote, setLocNote] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const locateGen = useRef(0);
  const applyPosition = (pos: GeolocationPosition, gen: number) => {
    if (gen !== locateGen.current) return;
    const city = nearestSampleCity(pos.coords.latitude, pos.coords.longitude);
    setLocating(false);
    setPlaceQuery("");
    if (!city) {
      setNearCity(null);
      setLocNote("We don’t have samples near you. Try searching a city or neighborhood.");
      rememberCity("all");
      return;
    }
    setNearCity(city);
    setLocNote(null);
    rememberCity(city);
  };
  const locate = (silent: boolean) => {
    const gen = ++locateGen.current;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      if (!silent) setLocNote("This browser can’t share your location. Try searching a city or neighborhood instead.");
      return;
    }
    setLocating(true);
    setLocNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => applyPosition(pos, gen),
      () => {
        if (gen !== locateGen.current) return;
        setLocating(false);
        if (!silent) setLocNote("Location’s turned off. Try searching a city or neighborhood instead.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  };
  useEffect(() => {
    const saved = lastCity();
    if (saved && saved !== "all" && isListedCity(saved)) {
      setPlaceQuery(saved);
      return;
    }
    const gen = ++locateGen.current;
    void (async () => {
      try {
        if (!navigator.permissions?.query) return;
        const status = await navigator.permissions.query({ name: "geolocation" });
        if (status.state !== "granted" || gen !== locateGen.current) return;
      } catch {
        return;
      }
      if (!navigator.geolocation || gen !== locateGen.current) return;
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => applyPosition(pos, gen),
        () => {
          if (gen !== locateGen.current) return;
          setLocating(false);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
      );
    })();
  }, []);
  const showAllSamples = () => {
    locateGen.current += 1;
    setPlaceQuery("");
    setNearCity(null);
    setLocNote(null);
    setLocating(false);
    rememberCity("all");
  };
  const [haul, setHaul] = useState<string>("all");
  const [size, setSize] = useState<string>("all");
  const [storeOnly, setStoreOnly] = useState(false);
  const [lotOk, setLotOk] = useState(false);

  const listings = useMemo(() => {
    if (!data?.listings) return [];
    const query = q.trim().toLowerCase();
    const place = placeQuery.trim();
    const cityLock = place ? null : nearCity;
    const filtered = data.listings.filter((l) => {
      if (cat !== "all" && l.category !== cat) return false;
      if (cityLock && cityOf(l.neighborhood) !== cityLock) return false;
      if (place && !listingInPlace(l.neighborhood, place)) return false;
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
    const fargo =
      cityLock === "Fargo–Moorhead" ||
      cityForQuery(place) === "Fargo–Moorhead" ||
      place.toLowerCase().includes("fargo");
    if (!fargo) return filtered;
    const contractor = (l: (typeof filtered)[number]) =>
      l.category === "outdoor" || l.haul === "truck" ? 0 : 1;
    return [...filtered].sort((a, b) => contractor(a) - contractor(b));
  }, [data?.listings, q, cat, placeQuery, nearCity, haul, size, storeOnly, lotOk]);

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
        <p className="mt-2 text-sm text-muted">Loading listings…</p>
      </main>
    );
  }

  return (
    <main className="pt-5">
      {signedIn ? <SignedHero /> : <GuestHero />}
      <LaunchChoices />

      <div className="mt-6 space-y-3">
        <PlaceFinder
          query={placeQuery}
          nearCity={nearCity}
          note={locNote}
          locating={locating}
          onQuery={(value) => {
            locateGen.current += 1;
            setLocating(false);
            setPlaceQuery(value);
            const city = cityForQuery(value);
            if (city) rememberCity(city);
          }}
          onLocate={() => locate(false)}
        />
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
            <p className="text-sm text-muted">Just samples for now. Nothing’s for sale until an official store opens.</p>
          </div>
          <Link to="/sales" className="shrink-0 text-sm font-medium text-primary-ink">
            All sales
          </Link>
        </div>
        {listings.length === 0 ? (
          <div className="rounded-2xl bg-surface px-4 py-10 text-center shadow-[var(--shadow-card)]">
            <p className="text-muted">
              {placeQuery.trim() || nearCity ? "No samples there." : "Nothing matches those filters. Try turning one off."}
            </p>
            {placeQuery.trim() || nearCity ? (
              <button type="button" className="mt-3 text-sm font-medium text-primary-ink" onClick={showAllSamples}>
                Show all samples
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

      <HandoffStrip spots={data.spots} place={placeQuery} nearCity={nearCity} />
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
          Rummlee isn’t open yet. Sign up and you’ll be the first to hear when it launches. Handoffs happen at an official store first, not at a stranger’s house. Nothing ships.
        </p>
        <p className="text-sm">
          <Link to="/films" className="font-medium text-primary-ink underline-offset-4 hover:underline">
            Six short films
          </Link>
        </p>
        <PatentPending className="text-sm text-muted" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Perk icon={CalendarDays} title="First to know" body="News and the launch, sent to your inbox. We don’t sell your email." />
          <Perk icon={EyeOff} title="A handle, not your name" body="Neighbors only see your handle. Your email, legal name, and home stay off the listing." />
          <Perk icon={Store} title="Official store handoff" body="A store holds the package for you. A public place is the backup. Person to person only if you both want it." />
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
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em]">Nothing’s for sale yet</h1>
      <p className="mt-1 text-sm font-medium text-primary-ink">Patent pending</p>
      <p className="mt-1 text-sm text-muted">These listings are just samples for now. Official store handoff first. Nothing ships.</p>
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
        <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">Hear when real items launch</h2>
        <p className="mt-1 text-sm text-muted">
          Leave your email and we’ll let you know when your city opens for real listings. Nothing’s for sale yet, and we don’t sell your email.
        </p>
        {joined ? (
          <p className="mt-3 rounded-2xl bg-primary-soft px-4 py-3 text-sm text-primary-ink">{joined}</p>
        ) : (
          <WaitlistForm idPrefix="home" onSuccess={setJoined} />
        )}
      </div>
      <div className="flex flex-col rounded-2xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">Be an official store</h2>
        <p className="mt-1 text-sm text-muted">
          Run a shop that could hold a paid item until the buyer picks it up? The form is short and it’s free to ask. Applying doesn’t make you a signed store.
        </p>
        <Link
          to="/handoff"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-fg"
        >
          Apply to be an official store
        </Link>
      </div>
    </section>
  );
}

function HandoffStrip({
  spots,
  place,
  nearCity,
}: {
  spots: HandoffSpot[];
  place: string;
  nearCity: string | null;
}) {
  const query = place.trim();
  const partners = spots
    .filter((s) => {
      if (s.kind !== "partner") return false;
      if (query) return listingInPlace(s.area, query);
      if (nearCity) return cityOf(s.area) === nearCity;
      return true;
    })
    .slice(0, 8);
  if (partners.length === 0) return null;
  const allSamples = partners.every((sp) => isSamplePartnerSpot(sp.id));
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">Official stores</h2>
          {allSamples ? (
            <p className="text-sm text-muted">These are sample names. No store has signed on.</p>
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

function PlaceFinder({
  query,
  nearCity,
  note,
  locating,
  onQuery,
  onLocate,
}: {
  query: string;
  nearCity: string | null;
  note: string | null;
  locating: boolean;
  onQuery: (value: string) => void;
  onLocate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const suggestions = placeSuggestions(query);
  const place = query.trim();
  const exact = suggestions.some((item) => item.toLowerCase() === place.toLowerCase());
  const showSuggestions = open && suggestions.length > 0 && !exact;
  let status: string | null = null;
  if (locating) status = "Checking what’s near you…";
  else if (place.length >= 2 && suggestions.length === 0) status = "We don’t have a sample place by that name.";
  else if (!place && nearCity) status = `Near you · ${nearCity}. Samples only.`;
  else if (!place && note) status = note;
  else if (!place) status = "Search a city or neighborhood, or use your location.";

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="relative min-w-0 flex-1">
          <Input
            value={query}
            onChange={(event) => {
              onQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
              if (event.key === "Enter" && showSuggestions && suggestions[0]) {
                event.preventDefault();
                onQuery(suggestions[0]);
                setOpen(false);
              }
            }}
            placeholder="Search a city or neighborhood"
            aria-label="Search a city or neighborhood"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            aria-controls="place-suggestions"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {showSuggestions ? (
            <ul
              id="place-suggestions"
              role="listbox"
              className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl bg-surface py-1 shadow-[var(--shadow-card)]"
            >
              {suggestions.map((item) => (
                <li key={item} role="presentation">
                  <button
                    type="button"
                    role="option"
                    className="w-full px-3.5 py-2.5 text-left text-sm text-fg hover:bg-bg"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onQuery(item);
                      setOpen(false);
                    }}
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="button"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-fg sm:mt-0"
          onClick={onLocate}
          disabled={locating}
        >
          {locating ? "Finding you…" : "Use my location"}
        </button>
      </div>
      {status ? (
        <p className="text-sm text-muted" aria-live="polite">
          {status}
        </p>
      ) : null}
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

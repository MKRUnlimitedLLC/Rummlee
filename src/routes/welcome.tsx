import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { CITIES, NEIGHBORHOODS } from "@/lib/rummlee/constants";
import { takeAfterLogin } from "@/lib/rummlee/draft";
import { errMessage } from "@/lib/rummlee/errors";
import { cityOf } from "@/lib/rummlee/format";
import { getMe, updateProfile } from "@/lib/rummlee/server";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/welcome")({ component: Welcome });

function Welcome() {
  const { user, isPending } = useCurrentUserState();
  const qc = useQueryClient();
  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: () => getMe(),
    enabled: Boolean(user),
  });
  const me = meQ.data?.me;
  const [handle, setHandle] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [zip, setZip] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!me || seeded) return;
    setHandle(me.handle);
    setCity(me.city ?? (me.neighborhood ? cityOf(me.neighborhood) : ""));
    setNeighborhood(me.neighborhood ?? "");
    setZip(me.zip ?? "");
    setFirst(me.legalFirstName ?? "");
    setLast(me.legalLastName ?? "");
    setPhone(me.phone ?? "");
    setSeeded(true);
  }, [me, seeded]);

  const hoods = city ? NEIGHBORHOODS.filter((n) => cityOf(n) === city) : NEIGHBORHOODS;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateProfile({
        data: {
          handle,
          city,
          neighborhood,
          zip,
          legalFirstName: first,
          legalLastName: last,
          phone,
        },
      });
      const saved = await getMe();
      if (!saved.me.profileComplete) {
        toast.error("Add a handle, neighborhood, legal name, and phone.");
        setBusy(false);
        return;
      }
      await qc.invalidateQueries({ queryKey: ["me"] });
      window.location.assign(takeAfterLogin());
    } catch (err) {
      toast.error(errMessage(err));
      setBusy(false);
    }
  }

  if (!isPending && !user) {
    return (
      <main className="mx-auto max-w-sm py-10">
        <Wordmark className="mb-8 justify-center" />
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">Create an account first</h1>
        <Button asChild className="mt-6 w-full">
          <Link to="/login">Sign in</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm py-10">
      <Wordmark className="mb-8 justify-center" />
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">Set up your account</h1>
      <p className="mt-2 text-pretty text-muted">
        Neighbors see @handle only. Your legal name and phone stay private. We never ask for a home address.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-3">
        <div>
          <Label htmlFor="handle">Handle</Label>
          <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} autoCapitalize="off" autoCorrect="off" required />
          <p className="mt-1 text-sm text-muted">This is the only name neighbors see.</p>
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <select id="city" className="h-11 w-full rounded-lg bg-bg px-3 text-base" value={city} onChange={(e) => { setCity(e.target.value); setNeighborhood(""); }} required>
            <option value="">Choose a city</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="hood">Neighborhood</Label>
          <select id="hood" className="h-11 w-full rounded-lg bg-bg px-3 text-base" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} required>
            <option value="">Choose a neighborhood</option>
            {hoods.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="zip">Zip (optional)</Label>
          <Input id="zip" inputMode="numeric" autoComplete="postal-code" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="58102" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="first">Legal first name</Label>
            <Input id="first" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="last">Legal last name</Label>
            <Input id="last" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} required />
          </div>
        </div>
        <p className="text-sm text-muted">Private. Not on listings, cards, or messages.</p>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <p className="mt-1 text-sm text-muted">Private. For handoff texts later. Neighbors do not see it.</p>
        </div>
        <Button type="submit" className="w-full" disabled={busy || meQ.isLoading}>
          {busy ? "Saving…" : "Continue"}
        </Button>
      </form>
    </main>
  );
}

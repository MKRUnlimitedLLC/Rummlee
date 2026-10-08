import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalSection } from "@/components/legal";
import { PatentPending } from "@/components/patent-pending";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Rummlee" },
      {
        name: "description",
        content:
          "A local marketplace from Fargo, North Dakota, getting ready to launch. Official store handoff first. Nothing ships. Handoff method patent pending.",
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <main className="py-8">
      <p className="text-sm font-medium text-primary-ink">Rummlee</p>
      <h1 className="mt-1 font-display text-3xl font-medium tracking-[-0.03em]">About</h1>
      <p className="mt-2 max-w-2xl text-pretty text-muted">
        The good stuff, before Saturday. Rummlee is where neighbors sell the stuff they already own. Handoffs happen at an official store first, with a public place as the backup. Nothing ships.
      </p>
      <div className="mt-8 max-w-2xl space-y-6 text-sm leading-relaxed text-fg">
        <PatentPending className="text-sm text-fg" />
        <LegalSection title="How a sale works">
          <p>
            The seller picks an asking price. You can pay it, or make one offer. The seller can send back one counteroffer. If either of you says no, that’s the end of it.
          </p>
          <p>
            Handoffs happen at an official store first. A public place is the backup. Meeting person to person is optional, and only after you’ve paid. Your home address never goes on the public card, and everyone goes by a handle, not a legal name.
          </p>
        </LegalSection>
        <LegalSection title="Where things stand">
          <p>
            Rummlee isn’t open yet. The listings you see are samples, and no card gets charged. No store has signed on so far. If you run a shop, you can{" "}
            <Link to="/handoff" className="font-medium text-primary-ink underline-offset-4 hover:underline">
              apply to be an official store
            </Link>
            . Applying doesn’t make it a signed store.
          </p>
        </LegalSection>
        <LegalSection title="Patent pending">
          <p>
            Handoff method patent pending. A U.S. provisional application is on file. It is not an issued patent. The
            company does not own it until an assignment is signed.
          </p>
        </LegalSection>
      </div>
      <footer className="mt-12 max-w-2xl border-t border-border pt-4">
        <p className="text-sm font-medium">The good stuff, before Saturday.</p>
        <PatentPending className="mt-1 text-xs text-muted" />
        <nav className="mt-3 text-xs text-subtle" aria-label="Footer">
          <Link to="/" className="underline-offset-4 hover:underline">Home</Link>
          <span className="mx-2">·</span>
          <Link to="/handoff" className="underline-offset-4 hover:underline">Official store</Link>
          <span className="mx-2">·</span>
          <Link to="/investors" className="underline-offset-4 hover:underline">Investors</Link>
          <span className="mx-2">·</span>
          <Link to="/fees" className="underline-offset-4 hover:underline">Fees</Link>
          <span className="mx-2">·</span>
          <Link to="/privacy" className="underline-offset-4 hover:underline">Privacy</Link>
          <span className="mx-2">·</span>
          <Link to="/terms" className="underline-offset-4 hover:underline">Terms</Link>
          <span className="mx-2">·</span>
          <Link to="/support" className="underline-offset-4 hover:underline">Support</Link>
        </nav>
        <p className="mt-3 text-xs text-subtle">© 2026 Rummlee</p>
      </footer>
    </main>
  );
}

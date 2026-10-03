import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalSection } from "@/components/legal";
import { PatentPending } from "@/components/patent-pending";

export const Route = createFileRoute("/about")({
  component: About,
});

function About() {
  return (
    <main className="py-8">
      <p className="text-sm font-medium text-primary-ink">Rummlee</p>
      <h1 className="mt-1 font-display text-3xl font-medium tracking-[-0.03em]">About</h1>
      <p className="mt-2 max-w-2xl text-pretty text-muted">
        The good stuff, before Saturday. Neighbors sell what they already own. Pickup is at an official handoff
        location. Nothing ships.
      </p>
      <div className="mt-8 max-w-2xl space-y-6 text-sm leading-relaxed text-fg">
        <PatentPending className="text-sm text-fg" />
        <LegalSection title="How a sale works">
          <p>
            The seller sets an asking price. The buyer pays that price, or makes one offer. Each side gets one
            counteroffer. A decline ends it.
          </p>
          <p>
            An official partner store is first. A public place is the backup. A private handoff is optional, and only
            after payment. A home address is not on the public card. People use a handle, not a legal name.
          </p>
        </LegalSection>
        <LegalSection title="Where it stands">
          <p>
            Rummlee is not open. The listings are samples. No card is charged. No store has signed. A store can{" "}
            <Link to="/handoff" className="font-medium text-primary-ink underline-offset-4 hover:underline">
              apply to be an official handoff location
            </Link>
            . An application is not a signed store.
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
          <Link to="/handoff" className="underline-offset-4 hover:underline">Handoff location</Link>
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

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function LegalPage({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <main className="py-8">
      <p className="text-sm font-medium text-primary-ink">Rummlee</p>
      <h1 className="mt-1 font-display text-3xl font-medium tracking-[-0.03em]">{title}</h1>
      <p className="mt-2 max-w-2xl text-pretty text-muted">{lede}</p>
      <div className="mt-8 max-w-2xl space-y-6 text-sm leading-relaxed text-fg">{children}</div>
      <LegalLinks className="mt-12" />
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-medium tracking-[-0.02em]">{title}</h2>
      <div className="mt-2 space-y-3 text-pretty text-fg">{children}</div>
    </section>
  );
}

export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav className={className} aria-label="Legal">
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-primary-ink">
        <li>
          <Link to="/fees" className="underline-offset-4 hover:underline">
            Fees
          </Link>
        </li>
        <li>
          <Link to="/privacy" className="underline-offset-4 hover:underline">
            Privacy
          </Link>
        </li>
        <li>
          <Link to="/terms" className="underline-offset-4 hover:underline">
            Terms
          </Link>
        </li>
        <li>
          <Link to="/support" className="underline-offset-4 hover:underline">
            Support
          </Link>
        </li>
        <li>
          <Link to="/corporate" className="underline-offset-4 hover:underline">
            Corporate
          </Link>
        </li>
      </ul>
    </nav>
  );
}

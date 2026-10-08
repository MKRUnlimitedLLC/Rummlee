import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { HandoffForm } from "@/components/launch-forms";
import { publicHead } from "@/lib/rummlee/seo";

export const Route = createFileRoute("/handoff")({
  head: () =>
    publicHead(
      "/handoff",
      "Become an official Rummlee store",
      "Got a shop that could hold a paid item until the buyer picks it up? Tell us about it. It’s free to ask.",
    ),
  component: HandoffPage,
});

function HandoffPage() {
  const [done, setDone] = useState<string | null>(null);
  return (
    <main className="py-8">
      <p className="text-sm font-medium text-primary-ink">Rummlee</p>
      <h1 className="mt-1 font-display text-3xl font-medium tracking-[-0.03em]">Become an official store</h1>
      <p className="mt-2 max-w-2xl text-pretty text-muted">
        Got a shop that could hold a paid item until the buyer comes for it? Tell us about it. If it fits a city we’re opening, we’ll write back. It’s free to ask. Just know this isn’t a promise of exclusivity, payment, or a go-live date. Questions? Write to{" "}
        <a className="font-medium text-primary-ink" href="mailto:stores@rummlee.com">
          stores@rummlee.com
        </a>
        .
      </p>
      <div className="mt-6 max-w-md">
        {done ? (
          <p role="status" className="rounded-2xl bg-surface p-5 text-pretty shadow-[var(--shadow-card)]">
            {done}
          </p>
        ) : (
          <HandoffForm
            idPrefix="page-handoff"
            onSuccess={(message) => {
              setDone(message);
              toast.success(message);
            }}
          />
        )}
      </div>
      <p className="mt-8 text-sm">
        <Link to="/" className="font-medium text-primary-ink">
          Back to browse
        </Link>
      </p>
    </main>
  );
}

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { HandoffForm } from "@/components/launch-forms";
import { publicHead } from "@/lib/rummlee/seo";

export const Route = createFileRoute("/handoff")({
  head: () =>
    publicHead(
      "/handoff",
      "Official Handoff Location",
      "Tell Rummlee about a shop that can hold a paid item for pickup. No fee to ask.",
    ),
  component: HandoffPage,
});

function HandoffPage() {
  const [done, setDone] = useState<string | null>(null);
  return (
    <main className="py-8">
      <p className="text-sm font-medium text-primary-ink">Rummlee</p>
      <h1 className="mt-1 font-display text-3xl font-medium tracking-[-0.03em]">Official Handoff Location</h1>
      <p className="mt-2 max-w-2xl text-pretty text-muted">
        A shop that can hold a paid item for pickup. We’ll write if it fits a city we’re opening. Asking is free. This is not a promise of exclusivity, payment, or a go-live date. Questions:{" "}
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

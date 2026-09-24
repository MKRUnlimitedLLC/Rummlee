import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errMessage } from "@/lib/rummlee/errors";
import { money } from "@/lib/rummlee/format";
import { getMe } from "@/lib/rummlee/server";
import { revealLow } from "@/lib/rummlee/reveal";

export function RummleeReveal({ listingId, signedIn }: { listingId: string; signedIn: boolean }) {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe(), enabled: signedIn });
  const trio = me.data?.me.plusTier === "trio";
  const [shown, setShown] = useState<{ floorCents: number; askingCents: number; fresh: boolean; left: number } | null>(null);
  const reveal = useMutation({
    mutationFn: () => revealLow({ data: listingId }),
    onSuccess: (res) => setShown(res),
    onError: (e) => toast.error(errMessage(e)),
  });

  if (!signedIn) return null;
  if (!trio) {
    return <p className="text-sm text-muted">+++ includes Rummlee Reveal. Five looks a month at a seller’s hidden low.</p>;
  }
  if (!shown) {
    return (
      <Button type="button" variant="secondary" disabled={reveal.isPending} onClick={() => reveal.mutate()}>
        {reveal.isPending ? "Revealing…" : "Rummlee Reveal"}
      </Button>
    );
  }
  const gap = shown.askingCents - shown.floorCents;
  return (
    <div className={shown.fresh ? "reveal-pop rounded-2xl bg-primary-soft px-4 py-4" : "rounded-2xl bg-bg px-4 py-4"}>
      <p className="text-sm font-medium text-primary-ink">Rummlee Reveal</p>
      <p className="font-display text-4xl font-semibold tabular-nums tracking-[-0.03em]">{money(shown.floorCents)}</p>
      <p className="mt-1 text-sm text-muted">
        {gap > 0 ? `${money(gap)} under asking.` : "Their low is the asking price. This one didn’t use a Reveal."}
      </p>
      <p className="mt-1 text-sm text-subtle">{shown.left} left this month.</p>
      <style>{`
        @keyframes rummlee-reveal {
          0% { transform: rotateX(88deg) scale(0.92); opacity: 0; }
          55% { transform: rotateX(-6deg) scale(1.03); opacity: 1; }
          100% { transform: rotateX(0deg) scale(1); opacity: 1; }
        }
        .reveal-pop { animation: rummlee-reveal 720ms cubic-bezier(.2,.85,.2,1); transform-origin: top center; }
        @media (prefers-reduced-motion: reduce) {
          .reveal-pop { animation: none; }
        }
      `}</style>
    </div>
  );
}
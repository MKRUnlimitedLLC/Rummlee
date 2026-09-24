import { useState } from "react";
import { BadgeCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PhotoInput } from "@/components/photo-input";
import { errMessage } from "@/lib/rummlee/errors";
import { submitRating } from "@/lib/rummlee/server";
import { ratingCriteria, type Thumb } from "@/lib/rummlee/trust";
import { cn } from "@/lib/utils";

export function VerifiedBadge({ verified, className }: { verified?: boolean; className?: string }) {
  if (!verified) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-sm font-medium text-primary-ink",
        className,
      )}
      title="ID Verified. This is on their account. Rummlee does not keep a photo of their ID."
    >
      <BadgeCheck className="size-4" strokeWidth={1.75} />
      ID Verified
    </span>
  );
}

export function ThumbTally({ up = 0, down = 0, className }: { up?: number; down?: number; className?: string }) {
  if (up + down === 0) return null;
  return (
    <span className={cn("text-sm text-muted", className)}>
      {up} up · {down} down
    </span>
  );
}

export function RateHandoff({
  orderId,
  role,
  otherHandle,
  handoffType,
}: {
  orderId: string;
  role: "buyer" | "seller";
  otherHandle: string;
  handoffType?: string;
}) {
  const qc = useQueryClient();
  const criteria = ratingCriteria(role);
  const [marks, setMarks] = useState<Record<string, Thumb | null>>({
    showed_up: null,
    as_agreed: null,
    respectful: null,
    packaged: null,
  });
  const [comment, setComment] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [counterReady, setCounterReady] = useState<Thumb | null>(null);
  const official = handoffType === "official";
  const save = useMutation({
    mutationFn: () =>
      submitRating({
        data: {
          orderId,
          showedUp: marks.showed_up as Thumb,
          asAgreed: marks.as_agreed as Thumb,
          respectful: marks.respectful as Thumb,
          packaged: role === "buyer" ? (marks.packaged as Thumb) : undefined,
          comment: comment.trim() || undefined,
          photoUrl: photoUrl || undefined,
          counterReady: official && counterReady ? counterReady : undefined,
        },
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["inbox"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["order", orderId] });
      toast.success(res.overall === "up" ? "Thumbs up sent. The comment and photo stay private." : "Thumbs down sent. The comment and photo stay private.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const ready = criteria.every((c) => marks[c.key] === "up" || marks[c.key] === "down") && (!official || counterReady != null);
  return (
    <form
      className="space-y-3 rounded-2xl bg-surface p-4 text-left shadow-[var(--shadow-card)]"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) save.mutate();
      }}
    >
      <p className="font-medium">Rate @{otherHandle}</p>
      <p className="text-sm text-muted">
        Thumbs up or down on each. Not stars. Comment is private — they never see it. A thumbs down can be
        challenged.
      </p>
      {criteria.map((c) => (
        <div key={c.key}>
          <p className="text-sm font-medium">{c.label}</p>
          <p className="text-sm text-muted">{c.hint}</p>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              className={cn(
                "inline-flex h-11 items-center gap-1 rounded-lg px-3 text-sm font-medium",
                marks[c.key] === "up" ? "bg-primary text-primary-fg" : "bg-bg text-fg",
              )}
              onClick={() => setMarks((m) => ({ ...m, [c.key]: "up" }))}
            >
              <ThumbsUp className="size-4" /> Up
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex h-11 items-center gap-1 rounded-lg px-3 text-sm font-medium",
                marks[c.key] === "down" ? "bg-fg text-primary-fg" : "bg-bg text-fg",
              )}
              onClick={() => setMarks((m) => ({ ...m, [c.key]: "down" }))}
            >
              <ThumbsDown className="size-4" /> Down
            </button>
          </div>
        </div>
      ))}
      {official ? (
        <div>
          <p className="text-sm font-medium">Counter was ready</p>
          <p className="text-sm text-muted">The store, not a person. They rate the handoff too. No names on their screen.</p>
          <div className="mt-1 flex gap-2">
            <button type="button" className={cn("inline-flex h-11 items-center gap-1 rounded-lg px-3 text-sm font-medium", counterReady === "up" ? "bg-primary text-primary-fg" : "bg-bg text-fg")} onClick={() => setCounterReady("up")}>
              <ThumbsUp className="size-4" /> Up
            </button>
            <button type="button" className={cn("inline-flex h-11 items-center gap-1 rounded-lg px-3 text-sm font-medium", counterReady === "down" ? "bg-fg text-primary-fg" : "bg-bg text-fg")} onClick={() => setCounterReady("down")}>
              <ThumbsDown className="size-4" /> Down
            </button>
          </div>
        </div>
      ) : null}
      <label className="block text-sm">
        <span className="font-medium">Private comment (optional)</span>
        <textarea
          className="mt-1 min-h-20 w-full rounded-lg bg-bg px-3 py-2 text-[15px]"
          maxLength={500}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Only Rummlee sees this — used if they challenge a thumbs down."
        />
      </label>
      <div>
        <p className="text-sm font-medium">Photo with the comment (optional)</p>
        <p className="text-sm text-muted">Private, same as the comment. They never see it.</p>
        <div className="mt-2">
          <PhotoInput value={photoUrl} onChange={setPhotoUrl} />
        </div>
        {photoUrl ? (
          <button type="button" className="mt-2 text-sm font-medium text-muted" onClick={() => setPhotoUrl("")}>
            Remove photo
          </button>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={!ready || save.isPending}>
        {save.isPending ? "Saving…" : "Send rating"}
      </Button>
    </form>
  );
}

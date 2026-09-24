import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { errMessage } from "@/lib/rummlee/errors";
import { fileNote, getListingNotes, NOTE_KINDS, replyNote, voteNote, type NoteKind } from "@/lib/rummlee/rep";

export function ListingNotes({
  listingId,
  mine,
  signedIn,
}: {
  listingId: string;
  mine: boolean;
  signedIn: boolean;
}) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notes", listingId], queryFn: () => getListingNotes({ data: listingId }) });
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<NoteKind>("missing_flaw");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const notes = q.data?.notes ?? [];
  const shown = notes.filter((note) => note.status === "shown");
  const proposed = notes.filter((note) => note.status === "proposed");

  const file = useMutation({
    mutationFn: () => fileNote({ data: { listingId, kind, body } }),
    onSuccess: () => {
      setBody("");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["notes", listingId] });
      toast.success("Note sent. It stays hidden until 2 neighbors mark it helpful.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const vote = useMutation({
    mutationFn: (data: { noteId: string; vote: "helpful" | "not_helpful" }) => voteNote({ data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notes", listingId] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const answer = useMutation({
    mutationFn: (noteId: string) => replyNote({ data: { noteId, reply } }),
    onSuccess: () => {
      setReply("");
      void qc.invalidateQueries({ queryKey: ["notes", listingId] });
      toast.success("Reply added.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <section className="mt-5 space-y-3 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-xl font-semibold">Listing notes</h2>
      <p className="text-sm text-muted">
        Like a community note. A miss stays hidden until 2 other neighbors mark it helpful. A note that neighbors call
        unhelpful costs the writer Rummlee Rep. It does not remove the listing.
      </p>
      {shown.map((note) => (
        <article key={note.id} className="rounded-2xl bg-primary-soft px-3 py-3 text-sm">
          <p className="font-medium text-primary-ink">Neighbors agreed · {note.kindLabel}</p>
          <p className="mt-1 text-fg">{note.body}</p>
          {note.sellerReply ? <p className="mt-2 text-muted">Seller: {note.sellerReply}</p> : null}
        </article>
      ))}
      {signedIn
        ? proposed.map((note) => (
            <article key={note.id} className="rounded-2xl bg-bg px-3 py-3 text-sm">
              <p className="font-medium">Waiting · {note.kindLabel}</p>
              <p className="mt-1">{note.body}</p>
              <p className="mt-1 text-muted">
                {note.helpful} helpful · {note.notHelpful} not helpful. Needs 2 on one side.
              </p>
              {note.sellerReply ? <p className="mt-2 text-muted">Seller: {note.sellerReply}</p> : null}
              {!note.mine && !mine ? (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="secondary" disabled={vote.isPending || note.myVote != null} onClick={() => vote.mutate({ noteId: note.id, vote: "helpful" })}>
                    Helpful
                  </Button>
                  <Button size="sm" variant="secondary" disabled={vote.isPending || note.myVote != null} onClick={() => vote.mutate({ noteId: note.id, vote: "not_helpful" })}>
                    Not helpful
                  </Button>
                </div>
              ) : null}
              {mine && !note.sellerReply ? (
                <form
                  className="mt-2 space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    answer.mutate(note.id);
                  }}
                >
                  <Label htmlFor={`reply-${note.id}`}>Your reply</Label>
                  <Textarea id={`reply-${note.id}`} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="What’s actually true" />
                  <Button size="sm" type="submit" disabled={answer.isPending || reply.trim().length < 4}>
                    Reply once
                  </Button>
                </form>
              ) : null}
            </article>
          ))
        : null}
      {!mine && signedIn ? (
        open ? (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              file.mutate();
            }}
          >
            <Label htmlFor="note-kind">What’s off</Label>
            <select
              id="note-kind"
              className="w-full rounded-xl bg-bg px-3 py-2 text-sm"
              value={kind}
              onChange={(event) => setKind(event.target.value as NoteKind)}
            >
              {NOTE_KINDS.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </select>
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="The photo shows a stain that the listing doesn’t mention." />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={file.isPending || body.trim().length < 12}>
                Send note
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button type="button" className="text-sm font-medium text-primary-ink" onClick={() => setOpen(true)}>
            Flag a description miss
          </button>
        )
      ) : null}
      {!signedIn ? <p className="text-sm text-muted">Sign in to flag a miss or vote on a note.</p> : null}
    </section>
  );
}

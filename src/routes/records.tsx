import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { GuestGate, useAuthGate } from "@/components/guest-gate";
import { StatementView } from "@/components/statement";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { errMessage } from "@/lib/rummlee/errors";
import { getMyStatement, openCase } from "@/lib/rummlee/records";

export const Route = createFileRoute("/records")({
  component: RecordsPage,
});

function RecordsPage() {
  const { user, showGuest, showLoading } = useAuthGate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["statement"], queryFn: () => getMyStatement(), enabled: Boolean(user) });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const send = useMutation({
    mutationFn: () => openCase({ data: { subject, body } }),
    onSuccess: () => {
      toast.success("Support has it.");
      setSubject("");
      setBody("");
      void qc.invalidateQueries({ queryKey: ["statement"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  if (showGuest) {
    return <GuestGate title="Your records" body="Orders, fees, and sales tax for this handle live here after you sign in." />;
  }
  if (showLoading || !user || q.isPending) return <div className="py-16 text-center text-muted">Loading…</div>;
  const statement = q.data;
  if (!statement) return null;

  return (
    <main className="py-6">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">Your records</h1>
      <p className="mt-1 max-w-xl text-muted">What you bought, what you sold, and the tax we collected. Support can see the same page.</p>
      <section className="mt-6 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
        <StatementView statement={statement} />
      </section>
      <section className="mt-6 max-w-lg rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl">Ask support</h2>
        <p className="mt-1 text-sm text-muted">A missing pickup, a fee, or a tax line. We answer on the corporate desk.</p>
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="body">What happened</Label>
            <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} required />
          </div>
          <Button type="submit" disabled={send.isPending}>
            {send.isPending ? "Sending…" : "Send"}
          </Button>
        </form>
        {statement.cases.length ? (
          <ul className="mt-4 space-y-2 text-sm">
            {statement.cases.map((item) => (
              <li key={item.id} className="rounded-xl bg-bg px-3 py-2">
                <p className="font-medium">
                  {item.subject} · {item.status}
                </p>
                <p className="text-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}

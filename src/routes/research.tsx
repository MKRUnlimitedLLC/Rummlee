import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PhotoInput } from "@/components/photo-input";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useAuthGate } from "@/components/guest-gate";
import { CATEGORIES, CONDITIONS, TEST_MODE } from "@/lib/rummlee/constants";
import { errMessage } from "@/lib/rummlee/errors";
import { money } from "@/lib/rummlee/format";
import {
  answerResearch,
  applyResearcher,
  askResearch,
  askResearcher,
  cancelResearch,
  claimResearch,
  decideResearch,
  getResearchDesk,
  getResearchItem,
  holdResearch,
  rateResearch,
  replyResearch,
  releaseResearch,
  resumeResearcher,
  setResearcher,
} from "@/lib/rummlee/research";

export const Route = createFileRoute("/research")({
  component: ResearchPage,
});

function ResearchPage() {
  const { user, showGuest, showLoading } = useAuthGate();
  const qc = useQueryClient();
  const desk = useQuery({ queryKey: ["research"], queryFn: () => getResearchDesk(), enabled: Boolean(user) });
  const [photos, setPhotos] = useState(["", "", ""]);
  const [note, setNote] = useState("");
  const [askCategory, setAskCategory] = useState<(typeof CATEGORIES)[number]["id"]>("furniture");
  const [openId, setOpenId] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [areas, setAreas] = useState<(typeof CATEGORIES)[number]["id"][]>([]);
  const [contractor, setContractor] = useState(false);

  const ask = useMutation({
    mutationFn: () => askResearcher({ data: { note, category: askCategory, photos: photos.filter(Boolean) } }),
    onSuccess: (res) => {
      setPhotos(["", "", ""]);
      setNote("");
      setOpenId(res.id);
      void qc.invalidateQueries({ queryKey: ["research"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Sent. Researchers who know that type get a ping.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const apply = useMutation({
    mutationFn: () => applyResearcher({ data: { city, areas, contractor: true } }),
    onSuccess: () => {
      setContractor(false);
      void qc.invalidateQueries({ queryKey: ["research"] });
      toast.success("Application sent. Corporate reviews it. No pay until you’re approved.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const resume = useMutation({
    mutationFn: () => resumeResearcher(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["research"] });
      toast.success("Researcher account is on again.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const pause = useMutation({
    mutationFn: () => setResearcher({ data: false }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["research"] });
      toast.success("Paused. You won’t be pinged.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  if (showGuest) {
    return (
      <main className="py-8">
        <h1 className="font-display text-3xl font-semibold">Ask a researcher</h1>
        <p className="mt-2 text-muted">Sign in to send photos or to apply as a researcher.</p>
        <Link to="/login" className="mt-4 inline-block font-medium text-primary-ink">Sign in</Link>
      </main>
    );
  }
  if (showLoading || !user || desk.isPending) return <main className="py-16 text-center text-muted">Loading…</main>;
  const data = desk.data;
  if (!data) return null;
  const account = data.account;

  return (
    <main className="py-6">
      <p className="text-sm font-medium text-primary-ink">Researchers</p>
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">Don’t know what it is?</h1>
      <p className="mt-2 max-w-xl text-muted">
        Add photos and a product type. An approved researcher in that area suggests what it is and a price range. You
        accept or pass. The range is not your asking price, and it is not an appraisal. Pay is {money(data.askCents)}.
        The researcher gets {money(data.payCents)} if you accept. If that item sells, they also get a bonus for a price
        in the top half of their range, and another if it sells at full asking. Both are on the fee table. +++ includes
        5 a month. After that, each one is {money(data.askCents)}.
        {data.includedLeft > 0 ? ` Rummlee +++ covers ${data.includedLeft} more this month.` : ""}{" "}
        {TEST_MODE ? "Test credits. No card is charged." : ""}
      </p>

      <section className="mt-6 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl">Send photos</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <PhotoInput
              key={index}
              value={photo}
              onChange={(url) => setPhotos((prev) => prev.map((item, i) => (i === index ? url : item)))}
            />
          ))}
        </div>
        <form
          className="mt-3 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            ask.mutate();
          }}
        >
          <Label htmlFor="research-kind">What kind of thing</Label>
          <select
            id="research-kind"
            className="w-full rounded-xl bg-bg px-3 py-2 text-sm"
            value={askCategory}
            onChange={(event) => setAskCategory(event.target.value as (typeof CATEGORIES)[number]["id"])}
          >
            {CATEGORIES.map((row) => (
              <option key={row.id} value={row.id}>{row.label}</option>
            ))}
          </select>
          <Label htmlFor="research-note">Anything you already know</Label>
          <Textarea id="research-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Found it in a box. No idea of the brand." />
          <Button type="submit" disabled={ask.isPending || photos.filter(Boolean).length === 0}>
            {ask.isPending ? "Sending…" : data.includedLeft > 0 ? `Ask a researcher · included (${data.includedLeft} left)` : `Ask a researcher · ${money(data.askCents)}`}
          </Button>
        </form>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-xl">Your requests</h2>
        {data.mine.length === 0 ? <p className="mt-2 text-sm text-muted">None yet.</p> : null}
        <ul className="mt-3 space-y-2">
          {data.mine.map((row) => (
            <li key={row.id}>
              <button type="button" className="w-full rounded-2xl bg-surface px-4 py-3 text-left shadow-[var(--shadow-card)]" onClick={() => setOpenId(row.id)}>
                <p className="font-medium">{row.title || row.note || "Photos sent"}</p>
                <p className="text-sm text-muted">
                  {row.status}
                  {row.researcher ? ` · @${row.researcher}` : ""}
                  {row.lowCents != null && row.highCents != null ? ` · ${money(row.lowCents)}–${money(row.highCents)}` : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl">Researcher account</h2>
        <p className="mt-1 text-sm text-muted">
          This is 1099 contract work, not a job. An accepted write-up pays {money(data.payCents)}, priced as 15 minutes
          at $18.40 an hour, the highest 2026 minimum wage. You pick the product types you know. A matching ask pings you. Research now starts 15 minutes.
          One item at a time. After those 15 minutes you can hold it once, for 15 more. For 2026, a 1099-NEC is filed if
          the year reaches $2,000. We do not store a Social Security number here. Beta pay is test credits.
        </p>
        {account ? (
          <div className="mt-3 text-sm">
            <p className="font-medium capitalize">{account.status} · {account.city}</p>
            <p className="mt-1 text-muted">
              This year: {money(account.yearCents)} across {account.yearCount} accepted write-up{account.yearCount === 1 ? "" : "s"}.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No application yet. The legal name on your account is the 1099 name.</p>
        )}
        {account?.status === "active" ? (
          <Button className="mt-3" variant="secondary" disabled={pause.isPending} onClick={() => pause.mutate()}>
            Pause account
          </Button>
        ) : null}
        {account?.status === "paused" ? (
          <Button className="mt-3" disabled={resume.isPending} onClick={() => resume.mutate()}>
            Resume
          </Button>
        ) : null}
        {account?.status === "pending" ? <p className="mt-3 text-sm">Application is with corporate.</p> : null}
        {!account || account.status === "denied" ? (
          <form
            className="mt-4 space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!areas.length) {
                toast.error("Pick at least one area.");
                return;
              }
              if (!contractor) {
                toast.error("Confirm this is contract work.");
                return;
              }
              apply.mutate();
            }}
          >
            <Label htmlFor="r-city">City you know</Label>
            <Input id="r-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Fargo" required />
            <p className="text-sm font-medium">Areas you can identify</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((row) => {
                const on = areas.includes(row.id);
                return (
                  <button
                    key={row.id}
                    type="button"
                    className={on ? "rounded-full bg-fg px-3 py-1.5 text-sm font-medium text-primary-fg" : "rounded-full bg-bg px-3 py-1.5 text-sm font-medium text-muted"}
                    onClick={() => setAreas((prev) => (on ? prev.filter((id) => id !== row.id) : [...prev, row.id]))}
                  >
                    {row.label}
                  </button>
                );
              })}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={contractor} onChange={(event) => setContractor(event.target.checked)} />
              I am applying as an independent contractor. This is not employment.
            </label>
            <Button type="submit" disabled={apply.isPending || !contractor || areas.length === 0}>
              {apply.isPending ? "Sending…" : "Apply"}
            </Button>
          </form>
        ) : null}
        {data.isResearcher ? (
          <ul className="mt-4 space-y-2">
            {data.queue.length === 0 ? <li className="text-sm text-muted">No photos in your areas.</li> : null}
            {data.queue.map((row) => (
              <li key={row.id}>
                <button type="button" className="w-full rounded-2xl bg-bg px-4 py-3 text-left" onClick={() => setOpenId(row.id)}>
                  <p className="font-medium">{row.note || "Photos to identify"}</p>
                  <p className="text-sm text-muted">
                    {row.category ? `${CATEGORIES.find((item) => item.id === row.category)?.label ?? row.category} · ` : ""}
                    {row.status === "open" ? "Open · Research now" : row.status === "claimed" ? "Yours · 15 minutes" : row.status}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {openId ? <Item id={openId} onClose={() => setOpenId(null)} /> : null}
      <p className="mt-6 text-sm text-muted">
        Fees live on the{" "}
        <Link to="/fees" className="font-medium text-primary-ink">fee table</Link>
        . When you accept a write-up, list the item yourself and set the price.
      </p>
    </main>
  );
}

function Clock({ dueAt, held, paused }: { dueAt: string | null; held: boolean; paused: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (paused) return <p className="text-sm font-medium">Clock is paused until the seller answers.</p>;
  if (!dueAt) return null;
  const left = Math.max(0, new Date(dueAt).getTime() - now);
  const min = Math.floor(left / 60000);
  const sec = Math.floor((left % 60000) / 1000);
  return (
    <p className="text-sm font-medium">
      {left === 0 ? "Time is up. Hold it once, or it goes back." : `${min}:${String(sec).padStart(2, "0")} left${held ? " · hold" : ""}`}
    </p>
  );
}

function Item({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["research", id], queryFn: () => getResearchItem({ data: id }) });
  const item = q.data;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["research"] });
    void qc.invalidateQueries({ queryKey: ["research", id] });
    void qc.invalidateQueries({ queryKey: ["me"] });
  };
  const claim = useMutation({
    mutationFn: () => claimResearch({ data: id }),
    onSuccess: () => {
      refresh();
      toast.success("It’s yours. You have 15 minutes.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const hold = useMutation({
    mutationFn: () => holdResearch({ data: id }),
    onSuccess: () => {
      refresh();
      toast.success("Held. 15 more minutes. Still your only item.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const release = useMutation({
    mutationFn: () => releaseResearch({ data: id }),
    onSuccess: () => {
      refresh();
      toast.success("Released. Someone else can take it.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: () => cancelResearch({ data: id }),
    onSuccess: () => {
      refresh();
      toast.success("Cancelled. The fee is back in your wallet.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const decide = useMutation({
    mutationFn: (accept: boolean) => decideResearch({ data: { id, accept } }),
    onSuccess: (_res, accept) => {
      refresh();
      toast.success(accept ? "Accepted. You still set the asking price when you list it." : "Passed. Another researcher can try.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <section className="mt-6 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">This request</h2>
        <button type="button" className="text-sm text-muted" onClick={onClose}>Close</button>
      </div>
      {q.isPending || !item ? <p className="mt-3 text-sm text-muted">Loading…</p> : null}
      {item ? (
        <div className="mt-3 space-y-3">
          {item.note ? <p className="text-sm">{item.note}</p> : null}
          <div className="grid gap-3 sm:grid-cols-3">
            {item.photos.map((photo) => (
              <img key={photo} src={photo} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
            ))}
          </div>
          {(item.canAnswer || item.paused) ? <Clock dueAt={item.dueAt} held={item.held} paused={item.paused} /> : null}
          {item.messages.length ? (
            <ul className="space-y-2">
              {item.messages.map((note) => (
                <li key={note.id} className="rounded-2xl bg-bg px-3 py-2 text-sm">
                  <p className="text-muted">{note.mine ? "You" : note.kind === "reply" ? "Seller" : "Researcher"}</p>
                  {note.body ? <p className="mt-1">{note.body}</p> : null}
                  {note.photos.length ? (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {note.photos.map((photo) => (
                        <img key={photo} src={photo} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {item.canAsk ? <AskSeller id={id} onDone={refresh} /> : null}
          {item.canReply ? <SellerReply id={id} onDone={refresh} /> : null}
          {item.title ? (
            <div className="text-sm">
              <p className="font-medium">{item.title}</p>
              <p className="mt-1">{item.description}</p>
              <p className="mt-1 text-muted">
                {item.condition}
                {item.category ? ` · ${item.category}` : ""}
                {item.lowCents != null && item.highCents != null ? ` · ${money(item.lowCents)}–${money(item.highCents)} suggested` : ""}
                {item.researcher ? ` · @${item.researcher}` : ""}
              </p>
            </div>
          ) : null}
          {item.canClaim ? (
            <Button onClick={() => claim.mutate()} disabled={claim.isPending}>
              {claim.isPending ? "Starting…" : "Research now"}
            </Button>
          ) : null}
          {item.canHold ? (
            <Button variant="secondary" onClick={() => hold.mutate()} disabled={hold.isPending}>
              {hold.isPending ? "Holding…" : "Request a hold"}
            </Button>
          ) : null}
          {item.canAnswer ? <AnswerForm id={id} onDone={refresh} /> : null}
          {item.canAnswer ? (
            <Button variant="secondary" onClick={() => release.mutate()} disabled={release.isPending}>Release it</Button>
          ) : null}
          {item.canDecide ? (
            <div className="flex gap-2">
              <Button onClick={() => decide.mutate(true)} disabled={decide.isPending}>Accept</Button>
              <Button variant="secondary" onClick={() => decide.mutate(false)} disabled={decide.isPending}>Pass</Button>
            </div>
          ) : null}
          {item.canRate ? <RateForm id={id} onDone={refresh} /> : null}
          {item.canCancel ? (
            <Button variant="secondary" onClick={() => cancel.mutate()} disabled={cancel.isPending}>Cancel and refund</Button>
          ) : null}
          {item.mine && item.status === "accepted" ? (
            <Link
              to="/listings/new"
              className="inline-block text-sm font-medium text-primary-ink"
              onClick={() => sessionStorage.setItem("rummlee-research", id)}
            >
              List it. You set the asking price. If it sells, the researcher can earn a bonus.
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function AskSeller({ id, onDone }: { id: string; onDone: () => void }) {
  const [body, setBody] = useState("");
  const send = useMutation({
    mutationFn: (kind: "question" | "more_photos") => askResearch({ data: { id, kind, body } }),
    onSuccess: () => {
      setBody("");
      onDone();
      toast.success("Sent. The clock is paused until they answer.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  return (
    <form className="space-y-2" onSubmit={(event) => event.preventDefault()}>
      <Label htmlFor="ask-seller">Ask the seller</Label>
      <Textarea id="ask-seller" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Is there a mark on the bottom?" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={send.isPending} onClick={() => send.mutate("question")}>Ask</Button>
        <Button type="button" size="sm" variant="secondary" disabled={send.isPending} onClick={() => send.mutate("more_photos")}>
          Request more photos
        </Button>
      </div>
    </form>
  );
}

function SellerReply({ id, onDone }: { id: string; onDone: () => void }) {
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState(["", "", ""]);
  const send = useMutation({
    mutationFn: () => replyResearch({ data: { id, body, photos: photos.filter(Boolean) } }),
    onSuccess: () => {
      setBody("");
      setPhotos(["", "", ""]);
      onDone();
      toast.success("Sent. Their clock is running again.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        send.mutate();
      }}
    >
      <Label htmlFor="seller-reply">Your answer</Label>
      <Textarea id="seller-reply" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Yes. Here’s a closer photo." />
      <div className="grid gap-3 sm:grid-cols-3">
        {photos.map((photo, index) => (
          <PhotoInput
            key={index}
            value={photo}
            onChange={(url) => setPhotos((prev) => prev.map((item, i) => (i === index ? url : item)))}
          />
        ))}
      </div>
      <Button type="submit" size="sm" disabled={send.isPending}>Send</Button>
    </form>
  );
}

function AnswerForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("other");
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]>("Good");
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const send = useMutation({
    mutationFn: () =>
      answerResearch({
        data: {
          id,
          title,
          description,
          category,
          condition,
          lowCents: Math.round(Number(low) * 100),
          highCents: Math.round(Number(high) * 100),
        },
      }),
    onSuccess: () => {
      onDone();
      toast.success("Sent to the seller.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        send.mutate();
      }}
    >
      <Label htmlFor="r-title">What it is</Label>
      <Input id="r-title" value={title} onChange={(event) => setTitle(event.target.value)} />
      <Label htmlFor="r-body">Description</Label>
      <Textarea id="r-body" value={description} onChange={(event) => setDescription(event.target.value)} />
      <Label htmlFor="r-cat">Category</Label>
      <select id="r-cat" className="w-full rounded-xl bg-bg px-3 py-2 text-sm" value={category} onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number]["id"])}>
        {CATEGORIES.map((row) => (
          <option key={row.id} value={row.id}>{row.label}</option>
        ))}
      </select>
      <Label htmlFor="r-cond">Condition</Label>
      <select id="r-cond" className="w-full rounded-xl bg-bg px-3 py-2 text-sm" value={condition} onChange={(event) => setCondition(event.target.value as (typeof CONDITIONS)[number])}>
        {CONDITIONS.map((row) => (
          <option key={row} value={row}>{row}</option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="r-low">Range low, dollars</Label>
          <Input id="r-low" inputMode="decimal" value={low} onChange={(event) => setLow(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="r-high">Range high, dollars</Label>
          <Input id="r-high" inputMode="decimal" value={high} onChange={(event) => setHigh(event.target.value)} />
        </div>
      </div>
      <Button type="submit" disabled={send.isPending}>Send write-up</Button>
    </form>
  );
}

function RateForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [marks, setMarks] = useState<{ description: "up" | "down" | null; accuracy: "up" | "down" | null; price: "up" | "down" | null }>({
    description: null,
    accuracy: null,
    price: null,
  });
  const send = useMutation({
    mutationFn: () =>
      rateResearch({
        data: {
          id,
          description: marks.description as "up" | "down",
          accuracy: marks.accuracy as "up" | "down",
          price: marks.price as "up" | "down",
        },
      }),
    onSuccess: () => {
      onDone();
      toast.success("Rating saved. It moves their Rep, not the payout.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const ready = marks.description && marks.accuracy && marks.price;
  const row = (key: "description" | "accuracy" | "price", label: string) => (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      <span className="flex gap-2">
        <button type="button" className={marks[key] === "up" ? "font-medium text-primary-ink" : "text-muted"} onClick={() => setMarks((prev) => ({ ...prev, [key]: "up" }))}>Up</button>
        <button type="button" className={marks[key] === "down" ? "font-medium text-primary-ink" : "text-muted"} onClick={() => setMarks((prev) => ({ ...prev, [key]: "down" }))}>Down</button>
      </span>
    </div>
  );
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        send.mutate();
      }}
    >
      <p className="text-sm font-medium">Rate the write-up</p>
      {row("description", "Description")}
      {row("accuracy", "Accuracy")}
      {row("price", "Price range")}
      <Button type="submit" size="sm" disabled={!ready || send.isPending}>Save rating</Button>
    </form>
  );
}

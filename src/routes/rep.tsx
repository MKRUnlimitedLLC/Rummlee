import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getScoreboard } from "@/lib/rummlee/rep";

export const Route = createFileRoute("/rep")({
  component: RepPage,
});

function rate(up: number, down: number) {
  const n = up + down;
  if (n < 3) return "—";
  return `${up}/${n} as listed`;
}

function rejects(dropoffs: number, refused: number) {
  if (dropoffs < 3) return "—";
  return `${refused}/${dropoffs} refused`;
}

function RepPage() {
  const q = useQuery({ queryKey: ["scoreboard"], queryFn: () => getScoreboard() });
  const rows = q.data?.board ?? [];
  const week = q.data?.week ?? [];
  const catches = [...rows].sort((a, b) => b.catches - a.catches || b.rep - a.rep).filter((row) => row.catches > 0);
  const facts = [...rows].sort((a, b) => b.facts - a.facts || b.rep - a.rep).filter((row) => row.facts > 0);

  return (
    <main className="py-6">
      <p className="text-sm font-medium text-primary-ink">Rummlee Rep</p>
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">Scoreboard</h1>
      <p className="mt-2 max-w-xl text-muted">
        Everyone starts at 100. A finished buy or sale is +1 each. A seller gets +2 when the buyer says the item was
        as listed, and +5 once for five official drop-offs with none refused. A neighbor gets +3 when others agree a
        description is off, and −4 when they don’t. Filling a blank the seller left is +2 if the seller approves it,
        and −2 if they decline it. The weekly board is this week’s points. It is not a cash contest. Handles only.
      </p>
      <section className="mt-6">
        <h2 className="font-display text-xl">Highest Rep</h2>
        {q.isPending ? <p className="mt-3 text-sm text-muted">Loading…</p> : null}
        {!q.isPending && rows.length === 0 ? <p className="mt-3 text-sm text-muted">No neighbors on the board yet.</p> : null}
        <ul className="mt-3 space-y-2">
          {rows.map((row, index) => (
            <li key={row.handle} className="flex items-baseline justify-between gap-3 rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
              <div>
                <p className="font-medium">
                  {index + 1}. @{row.handle}
                </p>
                <p className="text-sm text-muted">
                  {row.neighborhood ?? "Neighborhood not set"} · {rate(row.agreedUp, row.agreedDown)} · {rejects(row.dropoffs, row.refused)}
                </p>
              </div>
              <p className="font-display text-2xl font-semibold tabular-nums">{row.rep}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="font-display text-xl">This week</h2>
        <p className="mt-1 text-sm text-muted">Points since seven days ago. The board is the reward.</p>
        {week.length === 0 ? <p className="mt-3 text-sm text-muted">No points this week yet.</p> : null}
        <ul className="mt-3 space-y-2">
          {week.map((row, index) => (
            <li key={row.handle} className="flex items-baseline justify-between gap-3 rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
              <p className="font-medium">
                {index + 1}. @{row.handle}
              </p>
              <p className="font-display text-2xl font-semibold tabular-nums">{row.points}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="font-display text-xl">Catches</h2>
        <p className="mt-1 text-sm text-muted">Notes that other neighbors marked helpful.</p>
        {catches.length === 0 ? <p className="mt-3 text-sm text-muted">None yet.</p> : null}
        <ul className="mt-3 space-y-2">
          {catches.map((row) => (
            <li key={row.handle} className="flex items-baseline justify-between gap-3 rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
              <p className="font-medium">@{row.handle}</p>
              <p className="text-sm text-muted">{row.catches} caught</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="font-display text-xl">Additions the seller kept</h2>
        {facts.length === 0 ? <p className="mt-3 text-sm text-muted">None yet.</p> : null}
        <ul className="mt-3 space-y-2">
          {facts.map((row) => (
            <li key={row.handle} className="flex items-baseline justify-between gap-3 rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
              <p className="font-medium">@{row.handle}</p>
              <p className="text-sm text-muted">{row.facts} kept</p>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-6 text-sm text-muted">
        <Link to="/you" className="font-medium text-primary-ink">
          Your Rep
        </Link>{" "}
        is on You. Points are not money.
      </p>
    </main>
  );
}

import { money } from "@/lib/rummlee/format";
import type { Statement } from "@/lib/rummlee/records";

export function StatementView({ statement, staff }: { statement: Statement; staff?: boolean }) {
  const cells = [
    ["Bought", money(statement.buyerSpentCents), `${statement.buyerOrders} orders`],
    ["Buyer fees", money(statement.buyerFeesCents), "Service and store, not tax"],
    ["Sales tax paid", money(statement.buyerTaxCents), "Collected at checkout"],
    ["Sold", money(statement.sellerGrossCents), `${statement.sellerOrders} orders`],
    ["Seller fees", money(statement.sellerFeesCents), "Taken from the payout"],
    ["Seller net", money(statement.sellerNetCents), "Gross minus seller fees"],
    ["Tax on your sales", money(statement.sellerTaxCollectedCents), "Held for the place of handoff. Not your payout."],
  ];
  return (
    <div>
      <p className="text-sm text-muted">
        @{statement.handle} · {statement.year}
        {staff ? " · support view" : ""}
      </p>
      <p className="mt-1 text-sm text-muted">
        Test credits, not a tax form. Federal 1099-K for 2026 is more than $20,000 and more than 200 payments, both.
        States can be stricter. This is a record, not advice.
      </p>
      {statement.form1099kWatch ? (
        <p className="mt-3 rounded-xl bg-primary-soft px-3 py-2 text-sm text-primary-ink">
          This seller is over the 2026 federal 1099-K line. Confirm before anyone files.
        </p>
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {cells.map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl bg-bg px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
            <p className="font-display text-2xl font-semibold tracking-[-0.03em]">{value}</p>
            <p className="text-sm text-muted">{hint}</p>
          </div>
        ))}
      </div>
      {statement.taxByMetro.length ? (
        <div className="mt-4">
          <p className="text-sm font-medium">Sales tax by handoff city</p>
          <ul className="mt-2 space-y-1 text-sm">
            {statement.taxByMetro.map((place) => (
              <li key={place.metro} className="flex justify-between gap-3">
                <span>
                  {place.metro} · {place.orders}
                </span>
                <span className="tabular-nums">{money(place.taxCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">No sales tax on this year’s orders. Beta listings are usually $0.</p>
      )}
      {statement.lines.length ? (
        <ul className="mt-4 space-y-2">
          {statement.lines.map((line) => (
            <li key={line.id + line.role} className="rounded-xl bg-bg px-3 py-2 text-sm">
              <p className="font-medium">
                {line.role === "buyer" ? "Bought" : "Sold"} · {line.title}
              </p>
              <p className="text-muted">
                {money(line.amountCents)} · fees {money(line.role === "buyer" ? line.buyerFeeCents : line.sellerFeeCents)} ·
                tax {money(line.taxCents)}
                {line.metro ? ` · ${line.metro}` : ""} · {line.status}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">No paid orders this year yet.</p>
      )}
    </div>
  );
}

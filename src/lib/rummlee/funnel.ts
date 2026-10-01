import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { rememberFunnelStep, resetFunnelMemory, forgetFunnelStep, type FunnelOnce } from "./funnel-memory";

const stepSchema = z.enum(["started", "photo", "price", "published"]);

export type FunnelCounts = {
  started: number;
  photo: number;
  price: number;
  published: number;
};

export const markFunnelStep = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ step: stepSchema }).parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      insert into listing_funnel (day, step, n)
      values (current_date, ${data.step}, 1)
      on conflict (day, step) do update set n = listing_funnel.n + 1
    `;
    return { ok: true as const };
  });

export async function funnelCounts(): Promise<FunnelCounts> {
  const sql = await getSql();
  const rows = await sql<{ step: string; n: number }>`
    select step, coalesce(sum(n), 0)::int as n
    from listing_funnel
    where day >= current_date - 30
    group by step
  `;
  const counts: FunnelCounts = { started: 0, photo: 0, price: 0, published: 0 };
  for (const row of rows) {
    if (row.step === "started" || row.step === "photo" || row.step === "price" || row.step === "published") {
      counts[row.step] = Number(row.n);
    }
  }
  return counts;
}

const pending = new Set<string>();

/** Counts a step once per listing attempt. Stores no handle and no account id. */
export function noteListingStep(step: FunnelOnce) {
  if (typeof sessionStorage === "undefined" || pending.has(step)) return;
  if (!rememberFunnelStep(step, sessionStorage)) return;
  pending.add(step);
  void markFunnelStep({ data: { step } }).catch(() => {
    pending.delete(step);
    if (typeof sessionStorage !== "undefined") forgetFunnelStep(step, sessionStorage);
  });
}

export function finishListingAttempt() {
  pending.clear();
  if (typeof sessionStorage !== "undefined") resetFunnelMemory(sessionStorage);
}

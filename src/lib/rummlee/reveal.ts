import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { REVEALS_PER_MONTH } from "./constants";

async function trioActive(sql: Awaited<ReturnType<typeof getSql>>, userId: string) {
  const rows = await sql<{ plus_tier: string | null; is_premium: boolean; plus_until: string | null }>`
    select plus_tier, is_premium, plus_until from profiles where id = ${userId}
  `;
  const row = rows[0];
  return Boolean(row?.is_premium) && row?.plus_tier === "trio" && (!row.plus_until || new Date(row.plus_until).getTime() > Date.now());
}

async function usedThisMonth(sql: Awaited<ReturnType<typeof getSql>>, userId: string) {
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from reveals
    where profile_id = ${userId} and created_at >= date_trunc('month', now())
  `;
  return Number(rows[0]?.n ?? 0);
}

export const revealLow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((listingId: string) => listingId)
  .handler(async ({ context, data: listingId }) => {
    const sql = await getSql();
    if (!(await trioActive(sql, context.userId))) {
      throw new Error("Rummlee Reveal is included with +++. Five a month.");
    }
    const rows = await sql<{ seller_id: string; price_cents: number; floor_cents: number | null; status: string; charity_split: boolean | null }>`
      select seller_id, price_cents, floor_cents, status, charity_split from listings where id = ${listingId}
    `;
    const item = rows[0];
    if (!item || (item.status !== "live" && item.status !== "bundle")) throw new Error("That listing isn’t open.");
    if (item.seller_id === context.userId) throw new Error("You already see your own lowest.");
    if (item.charity_split) throw new Error("A Rummlee resale has no hidden low. Pay asking.");
    const floor = Number(item.floor_cents ?? item.price_cents);
    const asking = Number(item.price_cents);
    const prior = await sql<{ id: string }>`
      select id from reveals where profile_id = ${context.userId} and listing_id = ${listingId}
    `;
    const used = await usedThisMonth(sql, context.userId);
    if (prior[0] || floor >= asking) {
      return { floorCents: floor, askingCents: asking, fresh: false, left: Math.max(0, REVEALS_PER_MONTH - used) };
    }
    if (used >= REVEALS_PER_MONTH) throw new Error("You’ve used all 5 Reveals this month.");
    await sql`
      insert into reveals (id, profile_id, listing_id)
      values (${crypto.randomUUID()}, ${context.userId}, ${listingId})
      on conflict (profile_id, listing_id) do nothing
    `;
    const left = Math.max(0, REVEALS_PER_MONTH - (await usedThisMonth(sql, context.userId)));
    return { floorCents: floor, askingCents: asking, fresh: true, left };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { TEST_MODE } from "./constants";
import { syncReferralBooks } from "./referrals";

/** Seller is not paid until this window passes with no open problem. */
export const PAYOUT_HOLD_HOURS = 48;

type Sql = Awaited<ReturnType<typeof getSql>>;

async function requireProfile(sql: Sql, userId: string) {
  const rows = await sql<{ id: string; is_staff: boolean; deleted_at: string | null }>`
    select id, is_staff, deleted_at from profiles where id = ${userId}
  `;
  const me = rows[0];
  if (!me) throw new Error("No profile.");
  if (me.deleted_at) throw new Error("This account is closed. Sale records stay on file. Email support to reopen.");
  return me;
}

export async function writeLedger(
  sql: Sql,
  row: { orderId?: string | null; userId?: string | null; account: string; amountCents: number; note: string },
) {
  await sql`
    insert into ledger (id, order_id, user_id, account, amount_cents, test_mode, note)
    values (
      ${crypto.randomUUID()},
      ${row.orderId ?? null},
      ${row.userId ?? null},
      ${row.account},
      ${row.amountCents},
      ${TEST_MODE},
      ${row.note}
    )
  `;
}

export async function writeNotice(
  sql: Sql,
  row: { userId: string; kind: string; title: string; body: string; refId?: string | null },
) {
  await sql`
    insert into notices (id, user_id, kind, title, body, ref_id)
    values (
      ${crypto.randomUUID()},
      ${row.userId},
      ${row.kind},
      ${row.title},
      ${row.body},
      ${row.refId ?? null}
    )
  `;
}

export async function releaseDuePayouts(sql: Sql) {
  const due = await sql<{ id: string; seller_id: string; payout_cents: number | null }>`
    select id, seller_id, payout_cents from orders
    where status = ${"picked_up"}
      and paid_out_at is null
      and payable_at is not null
      and payable_at <= now()
      and (dispute_status is null or dispute_status = ${"released"})
    limit 40
  `;
  for (const row of due) {
    const won = await sql<{ id: string }>`
      update orders set paid_out_at = now()
      where id = ${row.id} and paid_out_at is null
      returning id
    `;
    if (!won[0]) continue;
    const payout = Number(row.payout_cents ?? 0);
    await sql`update profiles set wallet_cents = wallet_cents + ${payout} where id = ${row.seller_id}`;
    await sql`
      insert into wallet_tx (id, user_id, kind, amount_cents, ref_id, note)
      values (
        ${crypto.randomUUID()},
        ${row.seller_id},
        ${"payout"},
        ${payout},
        ${row.id},
        ${TEST_MODE ? "Test payout after the 48-hour window (not real money)" : "Payout after the 48-hour window"}
      )
    `;
    await writeLedger(sql, {
      orderId: row.id,
      userId: row.seller_id,
      account: "payout",
      amountCents: payout,
      note: "Seller payable released",
    });
    await writeNotice(sql, {
      userId: row.seller_id,
      kind: "payout",
      title: "Payout released",
      body: TEST_MODE
        ? "The 48-hour window passed with no problem reported. Test credits are in your wallet. Not real money."
        : "The 48-hour window passed with no problem reported. The payout is released.",
      refId: row.id,
    });
  }
  await syncReferralBooks(sql);
}

type HeldOrder = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount_cents: number;
  buyer_percent_cents: number;
  buyer_store_cents: number;
  tax_cents: number;
  buyer_paid_cents: number;
  fee_cents: number;
  status: string;
  checked_in_at: string | null;
  package_no: number | null;
};

export async function refundEscrow(sql: Sql, orderId: string, reason: string) {
  const rows = await sql<HeldOrder>`
    select id, listing_id, buyer_id, seller_id, amount_cents, buyer_percent_cents, buyer_store_cents,
           tax_cents, buyer_paid_cents, fee_cents, status, checked_in_at, package_no
    from orders where id = ${orderId}
  `;
  const order = rows[0];
  if (!order || order.status !== "escrow") return null;
  const won = await sql<{ id: string }>`
    update orders
    set status = ${"cancelled"}, dispute_note = ${reason}, dispute_status = ${"refunded"}
    where id = ${order.id} and status = ${"escrow"}
    returning id
  `;
  if (!won[0]) return null;
  const paid =
    Number(order.buyer_paid_cents) > 0
      ? Number(order.buyer_paid_cents)
      : Number(order.amount_cents) + Number(order.fee_cents) + Number(order.tax_cents);
  await sql`update profiles set wallet_cents = wallet_cents + ${paid} where id = ${order.buyer_id}`;
  await sql`
    insert into wallet_tx (id, user_id, kind, amount_cents, ref_id, note)
    values (
      ${crypto.randomUUID()},
      ${order.buyer_id},
      ${"refund"},
      ${paid},
      ${order.id},
      ${TEST_MODE ? `Test refund — ${reason}` : reason}
    )
  `;
  await writeLedger(sql, {
    orderId: order.id,
    userId: order.buyer_id,
    account: "refund",
    amountCents: -paid,
    note: reason,
  });
  if (!order.checked_in_at) {
    await sql`update listings set status = ${"live"} where id = ${order.listing_id} and status = ${"held"}`;
  }
  return order;
}

export const reportProblem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ orderId: z.string(), note: z.string().min(8).max(500) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireProfile(sql, context.userId);
    const rows = await sql<{
      id: string;
      buyer_id: string;
      seller_id: string;
      status: string;
      paid_out_at: string | null;
      payable_at: string | null;
      dispute_status: string | null;
      listing_title: string;
    }>`
      select o.id, o.buyer_id, o.seller_id, o.status, o.paid_out_at, o.payable_at, o.dispute_status,
             l.title as listing_title
      from orders o join listings l on l.id = o.listing_id
      where o.id = ${data.orderId}
    `;
    const order = rows[0];
    if (!order) throw new Error("Handoff not found.");
    if (order.buyer_id !== context.userId) throw new Error("Only the buyer can report a problem.");
    if (order.status !== "picked_up") throw new Error("Report a problem after you have the item.");
    if (order.paid_out_at) throw new Error("The payout window has already closed.");
    if (order.dispute_status === "open") throw new Error("A problem is already open on this handoff.");
    const note = data.note.trim();
    await sql`
      update orders set dispute_status = ${"open"}, dispute_note = ${note}
      where id = ${order.id} and paid_out_at is null
    `;
    await sql`
      insert into support_cases (id, profile_id, opened_by, status, subject, body)
      values (
        ${crypto.randomUUID()},
        ${order.buyer_id},
        ${context.userId},
        ${"open"},
        ${"Handoff problem"},
        ${`${order.listing_title}: ${note}`}
      )
    `;
    await writeNotice(sql, {
      userId: order.seller_id,
      kind: "dispute",
      title: "Payout held",
      body: "The buyer reported a problem. You are not paid until support decides. Test credits only, in beta.",
      refId: order.id,
    });
    return { ok: true as const };
  });

export const cancelHold = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ orderId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireProfile(sql, context.userId);
    const rows = await sql<{
      id: string;
      buyer_id: string;
      seller_id: string;
      status: string;
      checked_in_at: string | null;
    }>`
      select id, buyer_id, seller_id, status, checked_in_at from orders where id = ${data.orderId}
    `;
    const order = rows[0];
    if (!order) throw new Error("Handoff not found.");
    if (order.buyer_id !== context.userId && order.seller_id !== context.userId) throw new Error("Not your handoff.");
    if (order.status !== "escrow") throw new Error("This handoff is already closed.");
    if (order.checked_in_at) {
      throw new Error("The counter already has this package. The buyer can refuse it there, or the clerk can.");
    }
    const refunded = await refundEscrow(sql, order.id, "Hold cancelled before check-in");
    if (!refunded) throw new Error("Could not cancel this hold.");
    await writeNotice(sql, {
      userId: order.buyer_id,
      kind: "refund",
      title: "Hold cancelled",
      body: TEST_MODE
        ? "Test credits are back in the wallet. Not real money."
        : "The hold was cancelled and the payment was returned.",
      refId: order.id,
    });
    await writeNotice(sql, {
      userId: order.seller_id,
      kind: "refund",
      title: "Hold cancelled",
      body: "The handoff was cancelled before the counter took the package. The listing is live again.",
      refId: order.id,
    });
    return { ok: true as const };
  });

export const getOpenHolds = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = await requireProfile(sql, context.userId);
    if (!me.is_staff) return [];
    return sql<{
      id: string;
      title: string;
      payable_at: string | null;
      dispute_status: string | null;
      dispute_note: string | null;
      payout_cents: number | null;
      status: string;
    }>`
      select o.id, l.title, o.payable_at, o.dispute_status, o.dispute_note, o.payout_cents, o.status
      from orders o
      join listings l on l.id = o.listing_id
      where o.dispute_status = ${"open"}
         or (o.status = ${"picked_up"} and o.paid_out_at is null and o.payable_at is not null)
      order by o.payable_at asc nulls last
      limit 30
    `;
  });

export const resolveHold = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ orderId: z.string(), action: z.enum(["refund", "pay"]) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requireProfile(sql, context.userId);
    if (!me.is_staff) throw new Error("Support only.");
    const rows = await sql<{
      id: string;
      buyer_id: string;
      seller_id: string;
      status: string;
      paid_out_at: string | null;
      buyer_paid_cents: number;
      amount_cents: number;
      fee_cents: number;
      tax_cents: number;
    }>`
      select id, buyer_id, seller_id, status, paid_out_at, buyer_paid_cents, amount_cents, fee_cents, tax_cents
      from orders where id = ${data.orderId}
    `;
    const order = rows[0];
    if (!order) throw new Error("Handoff not found.");
    if (order.paid_out_at) throw new Error("Already paid out.");
    if (data.action === "pay") {
      await sql`
        update orders
        set dispute_status = ${"released"}, payable_at = now()
        where id = ${order.id} and paid_out_at is null
      `;
      await releaseDuePayouts(sql);
      return { ok: true as const };
    }
    const paid =
      Number(order.buyer_paid_cents) > 0
        ? Number(order.buyer_paid_cents)
        : Number(order.amount_cents) + Number(order.fee_cents) + Number(order.tax_cents);
    const won = await sql<{ id: string }>`
      update orders
      set dispute_status = ${"refunded"}, paid_out_at = now(),
          dispute_note = coalesce(dispute_note, ${"Support refunded the buyer"})
      where id = ${order.id} and paid_out_at is null
      returning id
    `;
    if (!won[0]) throw new Error("Already decided.");
    await sql`update profiles set wallet_cents = wallet_cents + ${paid} where id = ${order.buyer_id}`;
    await sql`
      insert into wallet_tx (id, user_id, kind, amount_cents, ref_id, note)
      values (
        ${crypto.randomUUID()}, ${order.buyer_id}, ${"refund"}, ${paid}, ${order.id},
        ${TEST_MODE ? "Test refund — support (not real money)" : "Support refund"}
      )
    `;
    await writeLedger(sql, {
      orderId: order.id,
      userId: order.buyer_id,
      account: "refund",
      amountCents: -paid,
      note: "Support refunded the buyer. Seller was not paid.",
    });
    await syncReferralBooks(sql);
    await writeNotice(sql, {
      userId: order.buyer_id,
      kind: "refund",
      title: "Refund issued",
      body: TEST_MODE ? "Support returned the test credits. Not real money." : "Support returned the payment.",
      refId: order.id,
    });
    await writeNotice(sql, {
      userId: order.seller_id,
      kind: "dispute",
      title: "No payout",
      body: "Support refunded the buyer. You are not paid on this handoff.",
      refId: order.id,
    });
    return { ok: true as const };
  });

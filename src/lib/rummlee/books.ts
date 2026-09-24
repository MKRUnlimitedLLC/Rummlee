import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { TEST_MODE } from "./constants";
import { releaseBundleChildren } from "./bundles";
import { syncReferralBooks } from "./referrals";
import { grantRep } from "./rep";

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

export async function expireOfficialHolds(sql: Sql) {
  const rows = await sql<{
    id: string;
    checked_in_at: string | null;
    handoff_spot_id: string | null;
    package_no: number | null;
  }>`
    select id, checked_in_at, handoff_spot_id, package_no from orders
    where status = ${"escrow"}
      and handoff_type = ${"official"}
      and (
        (checked_in_at is null and created_at < now() - interval '2 days')
        or (checked_in_at is not null and released_at is null and checked_in_at < now() - interval '5 days')
      )
    limit 40
  `;
  let closed = 0;
  for (const row of rows) {
    const reason = row.checked_in_at
      ? "Buyer did not pick it up within 5 days. The store hold is over."
      : "Seller did not drop it at the official store within 2 days.";
    const order = await refundEscrow(sql, row.id, reason);
    if (!order) continue;
    closed += 1;
    const { houseForSpot } = await import("./house");
    const fargo = Boolean(row.checked_in_at && houseForSpot(row.handoff_spot_id));
    await writeNotice(sql, {
      userId: order.buyer_id,
      kind: "hold",
      title: "Handoff refunded",
      body: reason,
      refId: order.id,
    });
    await writeNotice(sql, {
      userId: order.seller_id,
      kind: "hold",
      title: row.checked_in_at ? "The package is still at the store" : "Drop-off window closed",
      body: row.checked_in_at
        ? fargo
          ? "The buyer did not come. In your inbox, hold it for pickup or leave it. Leave it and it becomes Rummlee’s to resell in Fargo. You are not paid."
          : "The buyer did not come. The store is no longer required to hold it. Collect it from the counter."
        : "The item was not dropped off in time, so the buyer was refunded.",
      refId: order.id,
    });
  }
  return closed;
}

export async function runNightly(sql: Sql) {
  const released = await releaseDuePayouts(sql);
  const holdsClosed = await expireOfficialHolds(sql);
  return { released, holdsClosed };
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
  let released = 0;
  for (const row of due) {
    const won = await sql<{ id: string }>`
      update orders set paid_out_at = now()
      where id = ${row.id} and paid_out_at is null
      returning id
    `;
    if (!won[0]) continue;
    released += 1;
    const payout = Number(row.payout_cents ?? 0);
    const { charityShare, orderIsCharity, recordCharity } = await import("./house");
    const charityItem = await orderIsCharity(sql, row.id);
    const split = charityItem ? charityShare(payout) : null;
    const credit = split ? split.keep : payout;
    await sql`update profiles set wallet_cents = wallet_cents + ${credit} where id = ${row.seller_id}`;
    const payoutNote = split
      ? TEST_MODE
        ? "Resale half released. The other half is set aside for charity. Test credits, not real money."
        : "Resale half released. The other half is set aside for charity."
      : TEST_MODE
        ? "Test payout after the 48-hour window (not real money)"
        : "Payout after the 48-hour window";
    await sql`
      insert into wallet_tx (id, user_id, kind, amount_cents, ref_id, note)
      values (
        ${crypto.randomUUID()},
        ${row.seller_id},
        ${"payout"},
        ${credit},
        ${row.id},
        ${payoutNote}
      )
    `;
    if (split) {
      await recordCharity(sql, row.id, split.charity);
      await writeLedger(sql, {
        orderId: row.id,
        userId: null,
        account: "charity_payable",
        amountCents: split.charity,
        note: "Half of left-item seller proceeds. Not revenue.",
      });
      await writeLedger(sql, {
        orderId: row.id,
        userId: row.seller_id,
        account: "resale_proceeds",
        amountCents: split.keep,
        note: "Rummlee half of a left-item resale",
      });
    } else {
      await writeLedger(sql, {
        orderId: row.id,
        userId: row.seller_id,
        account: "payout",
        amountCents: payout,
        note: "Seller payable released",
      });
    }
    await writeNotice(sql, {
      userId: row.seller_id,
      kind: "payout",
      title: split ? "Resale half released" : "Payout released",
      body: split
        ? payoutNote
        : TEST_MODE
          ? "The 48-hour window passed with no problem reported. Test credits are in your wallet. Not real money."
          : "The 48-hour window passed with no problem reported. The payout is released.",
      refId: row.id,
    });
    const { payResearchBonuses } = await import("./research");
    await payResearchBonuses(sql, row.id);
  }
  await syncReferralBooks(sql);
  return released;
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
  const { restoreHouseListing } = await import("./house");
  const restored = await restoreHouseListing(sql, { id: order.id, listingId: order.listing_id });
  if (!restored && !order.checked_in_at) {
    await releaseBundleChildren(sql, order.listing_id);
    await sql`
      update listings set status = case when bundle_kind = ${"buyer"} then ${"bundle"} else ${"live"} end
      where id = ${order.listing_id} and status = ${"held"}
    `;
  }
  if (reason === "Counter refused the package") {
    await grantRep(sql, order.seller_id, "counter_refuse", -3, order.id);
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

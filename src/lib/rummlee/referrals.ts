import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { TEST_MODE } from "./constants";

/** Rates live here so they are not rendered on a page. */
const LEAD_SIDE_PERCENT = 5;
const PLUS_MONTH_CENTS = 250;
const STORE_50_COUNT = 50;
const STORE_50_CENTS = 50_000;
const STORE_500_COUNT = 500;
const STORE_500_CENTS = 200_000;
const AMBASSADOR_BASIS_CENTS = 2_500;
const AMBASSADOR_CENTS = 2_500;

type Sql = Awaited<ReturnType<typeof getSql>>;

type PayDraft = {
  referrerId: string;
  role: string;
  kind: string;
  userId?: string | null;
  orderId?: string | null;
  spotId?: string | null;
  side?: string | null;
  period?: string | null;
  basisCents: number;
  amountCents: number;
  sourceKey: string;
};

export function leadSideCents(basisCents: number) {
  if (basisCents <= 0) return 0;
  return Math.round((basisCents * LEAD_SIDE_PERCENT) / 100);
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function writeReferralLedger(
  sql: Sql,
  row: { orderId?: string | null; userId: string; amountCents: number; note: string },
) {
  await sql`
    insert into ledger (id, order_id, user_id, account, amount_cents, test_mode, note)
    values (
      ${crypto.randomUUID()},
      ${row.orderId ?? null},
      ${row.userId},
      ${"referral_payable"},
      ${row.amountCents},
      ${TEST_MODE},
      ${row.note}
    )
  `;
}

async function requireStaff(sql: Sql, userId: string) {
  const rows = await sql<{ id: string; is_staff: boolean; deleted_at: string | null }>`
    select id, is_staff, deleted_at from profiles where id = ${userId}
  `;
  const me = rows[0];
  if (!me || me.deleted_at) throw new Error("No profile.");
  if (!me.is_staff) throw new Error("Support only.");
  return me;
}

async function putPay(sql: Sql, row: PayDraft) {
  const existing = await sql<{ id: string; status: string }>`
    select id, status from referral_pay where source_key = ${row.sourceKey}
  `;
  if (existing[0]) return existing[0];
  const id = crypto.randomUUID();
  await sql`
    insert into referral_pay (
      id, referrer_id, role, kind, user_id, order_id, spot_id, side, period,
      basis_cents, amount_cents, status, test_mode, source_key
    )
    values (
      ${id},
      ${row.referrerId},
      ${row.role},
      ${row.kind},
      ${row.userId ?? null},
      ${row.orderId ?? null},
      ${row.spotId ?? null},
      ${row.side ?? null},
      ${row.period ?? null},
      ${row.basisCents},
      ${row.amountCents},
      ${"accrued"},
      ${TEST_MODE},
      ${row.sourceKey}
    )
  `;
  await writeReferralLedger(sql, {
    orderId: row.orderId ?? null,
    userId: row.referrerId,
    amountCents: row.amountCents,
    note: row.kind,
  });
  return { id, status: "accrued" };
}

async function setPayStatus(sql: Sql, sourceKey: string, status: "accrued" | "void", reason: string | null) {
  const rows = await sql<{ id: string; status: string; amount_cents: number; referrer_id: string; order_id: string | null; kind: string }>`
    select id, status, amount_cents, referrer_id, order_id, kind
    from referral_pay where source_key = ${sourceKey}
  `;
  const row = rows[0];
  if (!row || row.status === "paid" || row.status === status) return;
  await sql`
    update referral_pay
    set status = ${status}, void_reason = ${status === "void" ? reason : null}
    where id = ${row.id} and status <> ${"paid"}
  `;
  const sign = status === "void" ? -1 : 1;
  await writeReferralLedger(sql, {
    orderId: row.order_id,
    userId: row.referrer_id,
    amountCents: sign * Number(row.amount_cents),
    note: status === "void" ? `void ${row.kind}` : `restore ${row.kind}`,
  });
}

function buyerBasis(row: { buyer_percent_cents: number; buyer_store_cents: number; fee_cents: number }) {
  const split = Number(row.buyer_percent_cents) + Number(row.buyer_store_cents);
  return split > 0 ? split : Number(row.fee_cents);
}

function sellerBasis(row: { seller_percent_cents: number; seller_store_cents: number; seller_fee_cents: number }) {
  const split = Number(row.seller_percent_cents) + Number(row.seller_store_cents);
  return split > 0 ? split : Number(row.seller_fee_cents);
}

async function accrueReleasedSales(sql: Sql) {
  const orders = await sql<{
    id: string;
    buyer_id: string;
    seller_id: string;
    handoff_spot_id: string | null;
    buyer_percent_cents: number;
    buyer_store_cents: number;
    seller_percent_cents: number;
    seller_store_cents: number;
    fee_cents: number;
    seller_fee_cents: number;
  }>`
    select id, buyer_id, seller_id, handoff_spot_id,
           buyer_percent_cents, buyer_store_cents, seller_percent_cents, seller_store_cents,
           fee_cents, seller_fee_cents
    from orders
    where paid_out_at is not null
      and referral_synced_at is null
      and coalesce(dispute_status, '') <> 'refunded'
    limit 80
  `;
  for (const order of orders) {
    const sides = [
      { side: "buyer", userId: order.buyer_id, basis: buyerBasis(order) },
      { side: "seller", userId: order.seller_id, basis: sellerBasis(order) },
    ];
    for (const side of sides) {
      const ref = await sql<{ referrer_id: string; role: string; status: string }>`
        select u.referrer_id, r.role, r.status
        from referred_users u
        join referrers r on r.profile_id = u.referrer_id
        where u.user_id = ${side.userId}
      `;
      const lead = ref[0];
      if (!lead || lead.status !== "active" || lead.role !== "market_lead") continue;
      if (lead.referrer_id === side.userId) continue;
      const amount = leadSideCents(side.basis);
      if (amount <= 0) continue;
      await putPay(sql, {
        referrerId: lead.referrer_id,
        role: "market_lead",
        kind: "sale_side",
        userId: side.userId,
        orderId: order.id,
        spotId: order.handoff_spot_id,
        side: side.side,
        basisCents: side.basis,
        amountCents: amount,
        sourceKey: `sale:${order.id}:${side.side}`,
      });
    }
    await sql`update orders set referral_synced_at = now() where id = ${order.id}`;
  }
}

async function accruePlusMonths(sql: Sql) {
  const people = await sql<{
    user_id: string;
    referrer_id: string;
    plus_until: string | null;
    is_premium: boolean;
  }>`
    select u.user_id, u.referrer_id, p.plus_until, p.is_premium
    from referred_users u
    join referrers r on r.profile_id = u.referrer_id
    join profiles p on p.id = u.user_id
    where r.role = 'market_lead' and r.status = 'active' and u.referrer_id <> u.user_id
  `;
  const now = new Date();
  for (const person of people) {
    const charges = await sql<{ created_at: string; amount_cents: number; note: string | null }>`
      select created_at, amount_cents, note
      from wallet_tx
      where user_id = ${person.user_id} and kind = ${"premium"} and amount_cents < 0
      order by created_at
    `;
    for (const charge of charges) {
      const yearly = Number(charge.amount_cents) <= -5000 || (charge.note ?? "").toLowerCase().includes("year");
      const start = new Date(charge.created_at);
      const count = yearly ? 12 : 1;
      if (!person.is_premium || !person.plus_until) continue;
      const until = new Date(person.plus_until);
      for (let i = 0; i < count; i += 1) {
        const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
        if (cursor.getTime() > now.getTime()) break;
        if (cursor.getTime() >= until.getTime()) break;
        const period = monthKey(cursor);
        await putPay(sql, {
          referrerId: person.referrer_id,
          role: "market_lead",
          kind: "plus_month",
          userId: person.user_id,
          period,
          basisCents: Math.abs(Number(charge.amount_cents)),
          amountCents: PLUS_MONTH_CENTS,
          sourceKey: `plus:${person.user_id}:${period}`,
        });
      }
    }
  }
}

async function keptFeesForUser(sql: Sql, userId: string) {
  const sales = await sql<{ buyer_fees: number; seller_fees: number }>`
    select
      coalesce(sum(
        case
          when buyer_id = ${userId} and paid_out_at is not null and coalesce(dispute_status, '') <> 'refunded'
          then case
            when buyer_percent_cents + buyer_store_cents > 0 then buyer_percent_cents + buyer_store_cents
            else fee_cents
          end
          else 0
        end
      ), 0)::int as buyer_fees,
      coalesce(sum(
        case
          when seller_id = ${userId} and paid_out_at is not null and coalesce(dispute_status, '') <> 'refunded'
          then case
            when seller_percent_cents + seller_store_cents > 0 then seller_percent_cents + seller_store_cents
            else seller_fee_cents
          end
          else 0
        end
      ), 0)::int as seller_fees
    from orders
  `;
  const plus = await sql<{ cents: number }>`
    select coalesce(sum(-amount_cents), 0)::int as cents
    from wallet_tx
    where user_id = ${userId} and kind = ${"premium"} and amount_cents < 0
  `;
  return Number(sales[0]?.buyer_fees ?? 0) + Number(sales[0]?.seller_fees ?? 0) + Number(plus[0]?.cents ?? 0);
}

async function accrueAmbassadorBonuses(sql: Sql) {
  const people = await sql<{ user_id: string; referrer_id: string }>`
    select u.user_id, u.referrer_id
    from referred_users u
    join referrers r on r.profile_id = u.referrer_id
    where r.role = 'ambassador' and r.status = 'active' and u.referrer_id <> u.user_id
  `;
  for (const person of people) {
    const basis = await keptFeesForUser(sql, person.user_id);
    const key = `amb:${person.user_id}`;
    if (basis >= AMBASSADOR_BASIS_CENTS) {
      const existing = await sql<{ status: string }>`select status from referral_pay where source_key = ${key}`;
      if (existing[0]?.status === "void") {
        await setPayStatus(sql, key, "accrued", null);
      } else if (!existing[0]) {
        await putPay(sql, {
          referrerId: person.referrer_id,
          role: "ambassador",
          kind: "ambassador_bonus",
          userId: person.user_id,
          basisCents: basis,
          amountCents: AMBASSADOR_CENTS,
          sourceKey: key,
        });
      }
    } else {
      await setPayStatus(sql, key, "void", "Kept fees fell back under $25");
    }
  }
}

async function accrueStoreMilestones(sql: Sql) {
  const stores = await sql<{ spot_id: string; referrer_id: string; handoffs: number }>`
    select s.spot_id, s.referrer_id,
      (
        select count(*)::int from orders o
        where o.handoff_spot_id = s.spot_id
          and o.handoff_type = 'official'
          and o.paid_out_at is not null
          and coalesce(o.dispute_status, '') <> 'refunded'
      ) as handoffs
    from referred_stores s
    join referrers r on r.profile_id = s.referrer_id
    where r.role = 'market_lead' and r.status = 'active'
  `;
  for (const store of stores) {
    const milestones = [
      { count: STORE_50_COUNT, cents: STORE_50_CENTS, kind: "store_50" },
      { count: STORE_500_COUNT, cents: STORE_500_CENTS, kind: "store_500" },
    ];
    for (const milestone of milestones) {
      const key = `store:${store.spot_id}:${milestone.kind}`;
      if (Number(store.handoffs) >= milestone.count) {
        const existing = await sql<{ status: string }>`select status from referral_pay where source_key = ${key}`;
        if (existing[0]?.status === "void") await setPayStatus(sql, key, "accrued", null);
        else if (!existing[0]) {
          await putPay(sql, {
            referrerId: store.referrer_id,
            role: "market_lead",
            kind: milestone.kind,
            spotId: store.spot_id,
            basisCents: Number(store.handoffs),
            amountCents: milestone.cents,
            sourceKey: key,
          });
        }
      } else {
        await setPayStatus(sql, key, "void", "Completed handoffs dropped under the milestone");
      }
    }
  }
}

async function voidRefundedSales(sql: Sql) {
  const rows = await sql<{ source_key: string }>`
    select p.source_key
    from referral_pay p
    join orders o on o.id = p.order_id
    where p.kind = 'sale_side' and p.status = 'accrued' and o.dispute_status = 'refunded'
  `;
  for (const row of rows) {
    await setPayStatus(sql, row.source_key, "void", "Handoff refunded");
  }
}

/** Writes referral rows from kept fees. Does not pay anyone and does not render. */
export async function syncReferralBooks(sql: Sql) {
  await voidRefundedSales(sql);
  await accrueReleasedSales(sql);
  await accruePlusMonths(sql);
  await accrueAmbassadorBonuses(sql);
  await accrueStoreMilestones(sql);
}

function csvCell(value: string | number | boolean | null) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

const enrollInput = z.object({
  handle: z.string().min(2).max(40),
  role: z.enum(["market_lead", "ambassador"]),
  city: z.string().max(80).optional(),
  acceptingSignups: z.boolean().optional(),
});

export const enrollReferrer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => enrollInput.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireStaff(sql, context.userId);
    const handle = data.handle.replace(/^@/, "").trim();
    const profile = await sql<{ id: string }>`select id from profiles where handle = ${handle}`;
    const person = profile[0];
    if (!person) throw new Error("No account with that handle.");
    await sql`
      insert into referrers (profile_id, role, city, status, accepting_signups)
      values (${person.id}, ${data.role}, ${data.city?.trim() || null}, ${"active"}, ${data.acceptingSignups ?? true})
      on conflict (profile_id) do update
      set role = excluded.role,
          city = excluded.city,
          status = 'active',
          accepting_signups = excluded.accepting_signups
    `;
    return { ok: true as const };
  });

export const attributeNeighbor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ neighbor: z.string().min(2).max(40), referrer: z.string().min(2).max(40) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireStaff(sql, context.userId);
    const neighborHandle = data.neighbor.replace(/^@/, "").trim();
    const referrerHandle = data.referrer.replace(/^@/, "").trim();
    const neighbor = await sql<{ id: string }>`select id from profiles where handle = ${neighborHandle}`;
    const referrer = await sql<{ profile_id: string; status: string; accepting_signups: boolean }>`
      select r.profile_id, r.status, r.accepting_signups
      from referrers r
      join profiles p on p.id = r.profile_id
      where p.handle = ${referrerHandle}
    `;
    if (!neighbor[0]) throw new Error("No neighbor with that handle.");
    if (!referrer[0] || referrer[0].status !== "active") throw new Error("That referrer is not active.");
    if (!referrer[0].accepting_signups) throw new Error("That referrer is not taking new people.");
    if (neighbor[0].id === referrer[0].profile_id) throw new Error("A person cannot sign themselves up.");
    const prior = await sql<{ user_id: string }>`select user_id from referred_users where user_id = ${neighbor[0].id}`;
    if (prior[0]) throw new Error("That neighbor already has a referrer.");
    await sql`
      insert into referred_users (user_id, referrer_id) values (${neighbor[0].id}, ${referrer[0].profile_id})
    `;
    await sql`
      update orders set referral_synced_at = null
      where buyer_id = ${neighbor[0].id} or seller_id = ${neighbor[0].id}
    `;
    await syncReferralBooks(sql);
    return { ok: true as const };
  });

export const attributeStore = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ spotId: z.string().min(2), referrer: z.string().min(2).max(40) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireStaff(sql, context.userId);
    const handle = data.referrer.replace(/^@/, "").trim();
    const spot = await sql<{ id: string }>`select id from handoff_spots where id = ${data.spotId} and kind = ${"partner"}`;
    const referrer = await sql<{ profile_id: string; role: string; status: string }>`
      select r.profile_id, r.role, r.status
      from referrers r join profiles p on p.id = r.profile_id
      where p.handle = ${handle}
    `;
    if (!spot[0]) throw new Error("No official store with that id.");
    if (!referrer[0] || referrer[0].status !== "active" || referrer[0].role !== "market_lead") {
      throw new Error("Only an active market lead can be credited for a store.");
    }
    await sql`
      insert into referred_stores (spot_id, referrer_id)
      values (${spot[0].id}, ${referrer[0].profile_id})
      on conflict (spot_id) do update set referrer_id = excluded.referrer_id
    `;
    await syncReferralBooks(sql);
    return { ok: true as const };
  });

export const referralLedgerFile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await requireStaff(sql, context.userId);
    await syncReferralBooks(sql);
    const rows = await sql<{
      created_at: string;
      test_mode: boolean;
      handle: string;
      role: string;
      city: string | null;
      kind: string;
      period: string | null;
      side: string | null;
      neighbor: string | null;
      order_id: string | null;
      spot_name: string | null;
      basis_cents: number;
      amount_cents: number;
      status: string;
      payout_id: string | null;
      void_reason: string | null;
      source_key: string;
    }>`
      select p.created_at, p.test_mode, pr.handle, p.role, r.city, p.kind, p.period, p.side,
             n.handle as neighbor, p.order_id, hs.name as spot_name,
             p.basis_cents, p.amount_cents, p.status, p.payout_id, p.void_reason, p.source_key
      from referral_pay p
      join profiles pr on pr.id = p.referrer_id
      join referrers r on r.profile_id = p.referrer_id
      left join profiles n on n.id = p.user_id
      left join handoff_spots hs on hs.id = p.spot_id
      order by p.created_at
    `;
    const header = [
      "created_at",
      "test_mode",
      "referrer_handle",
      "role",
      "city",
      "kind",
      "period",
      "side",
      "neighbor_handle",
      "order_id",
      "spot_name",
      "basis_cents",
      "amount_cents",
      "status",
      "payout_id",
      "void_reason",
      "source_key",
    ];
    const lines = rows.map((row) =>
      [
        row.created_at,
        row.test_mode,
        row.handle,
        row.role,
        row.city,
        row.kind,
        row.period,
        row.side,
        row.neighbor,
        row.order_id,
        row.spot_name,
        row.basis_cents,
        row.amount_cents,
        row.status,
        row.payout_id,
        row.void_reason,
        row.source_key,
      ]
        .map((cell) => csvCell(cell))
        .join(","),
    );
    const day = new Date().toISOString().slice(0, 10);
    return { filename: `rummlee-referral-ledger-${day}.csv`, csv: [header.join(","), ...lines].join("\n") };
  });

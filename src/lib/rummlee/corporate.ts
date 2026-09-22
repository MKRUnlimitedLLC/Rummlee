import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ensureSeed } from "./seed";
import { ensureProfile, optionalUserId } from "./server";

export type Admission = {
  id: string;
  kind: "store" | "staff";
  status: "pending" | "admitted" | "denied";
  orgName: string;
  contactName: string;
  email: string;
  city: string;
  note: string | null;
  applicantId: string | null;
  createdAt: string;
};

export type CorporateMetrics = {
  gmvCents: number;
  netRevenueCents: number;
  takeRateBps: number;
  orders: number;
  aovCents: number;
  cancelRateBps: number;
  pickupRateBps: number;
  liveListings: number;
  sellThroughBps: number;
  activeBuyers: number;
  activeSellers: number;
  offerAcceptBps: number;
  officialShareBps: number;
  plusMembers: number;
  verifiedProfiles: number;
  pendingAdmissions: number;
};

function bps(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 10000);
}

async function requireStaff(userId: string) {
  const sql = await getSql();
  await ensureSeed(sql);
  const me = await ensureProfile(sql, userId);
  if (!me.isStaff) throw new Error("Corporate desk is for operators.");
  return { sql, me };
}

export const getCorporateDesk = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  await ensureSeed(sql);
  const userId = await optionalUserId();
  if (!userId) return { signedIn: false as const, isStaff: false, metrics: null, queue: [] as Admission[] };
  const me = await ensureProfile(sql, userId);
  const mine = await sql<{
    id: string;
    kind: string;
    status: string;
    org_name: string;
    contact_name: string;
    email: string;
    city: string;
    note: string | null;
    applicant_id: string | null;
    created_at: string;
  }>`
    select id, kind, status, org_name, contact_name, email, city, note, applicant_id, created_at
    from admissions
    where applicant_id = ${userId} or ${me.isStaff} = true
    order by created_at desc
    limit 80
  `;
  const queue = mine.map(mapAdmission);
  if (!me.isStaff) return { signedIn: true as const, isStaff: false, metrics: null, queue };
  const metrics = await loadMetrics(sql);
  return { signedIn: true as const, isStaff: true, metrics, queue };
});

function mapAdmission(row: {
  id: string;
  kind: string;
  status: string;
  org_name: string;
  contact_name: string;
  email: string;
  city: string;
  note: string | null;
  applicant_id: string | null;
  created_at: string;
}): Admission {
  return {
    id: row.id,
    kind: row.kind === "staff" ? "staff" : "store",
    status: row.status === "admitted" || row.status === "denied" ? row.status : "pending",
    orgName: row.org_name,
    contactName: row.contact_name,
    email: row.email,
    city: row.city,
    note: row.note,
    applicantId: row.applicant_id,
    createdAt: row.created_at,
  };
}

async function loadMetrics(sql: Awaited<ReturnType<typeof getSql>>): Promise<CorporateMetrics> {
  const orders = await sql<{
    gmv: number;
    fees: number;
    orders: number;
    cancelled: number;
    picked: number;
    official: number;
    buyers: number;
    sellers: number;
  }>`
    select
      coalesce(sum(amount_cents) filter (where status <> 'cancelled' and created_at >= now() - interval '30 days'), 0)::int as gmv,
      coalesce(sum(fee_cents) filter (where status <> 'cancelled' and created_at >= now() - interval '30 days'), 0)::int as fees,
      count(*) filter (where status <> 'cancelled' and created_at >= now() - interval '30 days')::int as orders,
      count(*) filter (where status = 'cancelled' and created_at >= now() - interval '30 days')::int as cancelled,
      count(*) filter (where status = 'picked_up' and created_at >= now() - interval '30 days')::int as picked,
      count(*) filter (where status <> 'cancelled' and created_at >= now() - interval '30 days' and handoff_type in ('official', 'partner'))::int as official,
      count(distinct buyer_id) filter (where status <> 'cancelled' and created_at >= now() - interval '30 days')::int as buyers,
      count(distinct seller_id) filter (where status <> 'cancelled' and created_at >= now() - interval '30 days')::int as sellers
    from orders
  `;
  const listings = await sql<{ live: number; sold: number; held: number }>`
    select
      count(*) filter (where status = 'live')::int as live,
      count(*) filter (where status = 'sold')::int as sold,
      count(*) filter (where status = 'held')::int as held
    from listings
  `;
  const offers = await sql<{ decided: number; accepted: number }>`
    select
      count(*) filter (where status in ('accepted', 'declined') and created_at >= now() - interval '30 days')::int as decided,
      count(*) filter (where status = 'accepted' and created_at >= now() - interval '30 days')::int as accepted
    from offers
  `;
  const people = await sql<{ plus: number; verified: number }>`
    select
      count(*) filter (where is_premium = true)::int as plus,
      count(*) filter (where verified_at is not null)::int as verified
    from profiles
  `;
  const extra = await sql<{ cents: number }>`
    select coalesce(sum(-amount_cents) filter (where amount_cents < 0 and kind in ('plus', 'sale_day', 'verify', 'list') and created_at >= now() - interval '30 days'), 0)::int as cents
    from wallet_tx
  `;
  const pending = await sql<{ n: number }>`select count(*)::int as n from admissions where status = 'pending'`;
  const o = orders[0];
  const l = listings[0];
  const gmv = Number(o?.gmv ?? 0);
  const orderFees = Number(o?.fees ?? 0);
  const orderCount = Number(o?.orders ?? 0);
  const cancelled = Number(o?.cancelled ?? 0);
  const live = Number(l?.live ?? 0);
  const sold = Number(l?.sold ?? 0);
  const held = Number(l?.held ?? 0);
  const listed = live + sold + held;
  return {
    gmvCents: gmv,
    netRevenueCents: orderFees + Number(extra[0]?.cents ?? 0),
    takeRateBps: bps(orderFees, gmv),
    orders: orderCount,
    aovCents: orderCount ? Math.round(gmv / orderCount) : 0,
    cancelRateBps: bps(cancelled, orderCount + cancelled),
    pickupRateBps: bps(Number(o?.picked ?? 0), orderCount),
    liveListings: live,
    sellThroughBps: bps(sold, listed),
    activeBuyers: Number(o?.buyers ?? 0),
    activeSellers: Number(o?.sellers ?? 0),
    offerAcceptBps: bps(Number(offers[0]?.accepted ?? 0), Number(offers[0]?.decided ?? 0)),
    officialShareBps: bps(Number(o?.official ?? 0), orderCount),
    plusMembers: Number(people[0]?.plus ?? 0),
    verifiedProfiles: Number(people[0]?.verified ?? 0),
    pendingAdmissions: Number(pending[0]?.n ?? 0),
  };
}

const applicationInput = z.object({
  kind: z.enum(["store", "staff"]),
  orgName: z.string().min(2).max(80),
  contactName: z.string().min(2).max(80),
  email: z.string().email().max(120),
  city: z.string().min(2).max(80),
  note: z.string().max(500).optional(),
});

export const submitAdmission = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => applicationInput.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const open = await sql<{ id: string }>`
      select id from admissions
      where applicant_id = ${context.userId} and kind = ${data.kind} and status = 'pending'
      limit 1
    `;
    if (open[0]) throw new Error("You already have an application in review.");
    const id = crypto.randomUUID();
    await sql`
      insert into admissions (id, kind, status, org_name, contact_name, email, city, note, applicant_id)
      values (
        ${id}, ${data.kind}, ${"pending"}, ${data.orgName.trim()}, ${data.contactName.trim()},
        ${data.email.trim().toLowerCase()}, ${data.city.trim()}, ${data.note?.trim() || null}, ${context.userId}
      )
    `;
    return { id };
  });

export const decideAdmission = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.string(), decision: z.enum(["admit", "deny"]) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { sql } = await requireStaff(context.userId);
    const rows = await sql<{
      id: string;
      kind: string;
      status: string;
      org_name: string;
      city: string;
      note: string | null;
      applicant_id: string | null;
    }>`
      select id, kind, status, org_name, city, note, applicant_id from admissions where id = ${data.id}
    `;
    const row = rows[0];
    if (!row) throw new Error("Application not found.");
    if (row.status !== "pending") throw new Error("Already decided.");
    const status = data.decision === "admit" ? "admitted" : "denied";
    await sql`
      update admissions
      set status = ${status}, decided_by = ${context.userId}, decided_at = now()
      where id = ${row.id}
    `;
    if (data.decision === "admit" && row.kind === "store") {
      const spotId = `partner-${row.id.slice(0, 8)}`;
      await sql`
        insert into handoff_spots (id, name, area, hint, kind)
        values (
          ${spotId},
          ${row.org_name},
          ${row.city},
          ${row.note?.trim() || "Official store. Admitted by corporate. Store hours. Step-free if the store says so."},
          ${"partner"}
        )
        on conflict (id) do nothing
      `;
    }
    if (data.decision === "admit" && row.kind === "staff" && row.applicant_id) {
      await sql`update profiles set is_staff = true where id = ${row.applicant_id}`;
    }
    return { ok: true as const, status };
  });

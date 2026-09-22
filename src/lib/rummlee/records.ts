import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ensureProfile } from "./server";

/** 2026 federal 1099-K: both must be exceeded. Not a filing. State rules can differ. */
export const FORM_1099K_GROSS_CENTS = 2_000_000;
export const FORM_1099K_COUNT = 200;

export type RecordLine = {
  id: string;
  role: "buyer" | "seller";
  title: string;
  metro: string | null;
  status: string;
  amountCents: number;
  buyerFeeCents: number;
  sellerFeeCents: number;
  taxCents: number;
  createdAt: string;
};

export type TaxPlace = { metro: string; taxCents: number; orders: number };

export type SupportCase = {
  id: string;
  status: "open" | "closed";
  subject: string;
  body: string;
  createdAt: string;
};

export type Statement = {
  year: number;
  handle: string;
  testMode: true;
  buyerSpentCents: number;
  buyerFeesCents: number;
  buyerTaxCents: number;
  buyerOrders: number;
  sellerGrossCents: number;
  sellerFeesCents: number;
  sellerNetCents: number;
  sellerTaxCollectedCents: number;
  sellerOrders: number;
  form1099kWatch: boolean;
  taxByMetro: TaxPlace[];
  lines: RecordLine[];
  cases: SupportCase[];
};

type OrderRow = {
  id: string;
  title: string;
  buyer_id: string;
  seller_id: string;
  amount_cents: number;
  fee_cents: number;
  buyer_fee_cents: number;
  seller_fee_cents: number;
  tax_cents: number;
  metro: string | null;
  status: string;
  created_at: string;
};

function mapLine(row: OrderRow, userId: string): RecordLine {
  const buyerFee = Number(row.buyer_fee_cents) > 0 ? Number(row.buyer_fee_cents) : Number(row.fee_cents);
  return {
    id: row.id,
    role: row.buyer_id === userId ? "buyer" : "seller",
    title: row.title,
    metro: row.metro,
    status: row.status,
    amountCents: Number(row.amount_cents),
    buyerFeeCents: buyerFee,
    sellerFeeCents: Number(row.seller_fee_cents),
    taxCents: Number(row.tax_cents),
    createdAt: row.created_at,
  };
}

async function statementFor(profileId: string): Promise<Statement> {
  const sql = await getSql();
  const me = await ensureProfile(sql, profileId);
  const year = new Date().getFullYear();
  const rows = await sql<OrderRow>`
    select o.id, l.title, o.buyer_id, o.seller_id, o.amount_cents, o.fee_cents,
           o.buyer_fee_cents, o.seller_fee_cents, o.tax_cents, o.metro, o.status, o.created_at
    from orders o
    join listings l on l.id = o.listing_id
    where (o.buyer_id = ${profileId} or o.seller_id = ${profileId})
      and extract(year from o.created_at) = ${year}
      and o.status <> 'cancelled'
    order by o.created_at desc
    limit 200
  `;
  const lines = rows.map((row) => mapLine(row, profileId));
  let buyerSpent = 0;
  let buyerFees = 0;
  let buyerTax = 0;
  let buyerOrders = 0;
  let sellerGross = 0;
  let sellerFees = 0;
  let sellerTax = 0;
  let sellerOrders = 0;
  const places = new Map<string, TaxPlace>();
  for (const line of lines) {
    if (line.role === "buyer") {
      buyerOrders += 1;
      buyerSpent += line.amountCents;
      buyerFees += line.buyerFeeCents;
      buyerTax += line.taxCents;
    } else {
      sellerOrders += 1;
      sellerGross += line.amountCents;
      sellerFees += line.sellerFeeCents;
      sellerTax += line.taxCents;
    }
    if (line.taxCents > 0) {
      const key = line.metro || "Unknown";
      const cur = places.get(key) ?? { metro: key, taxCents: 0, orders: 0 };
      cur.taxCents += line.taxCents;
      cur.orders += 1;
      places.set(key, cur);
    }
  }
  const cases = await sql<{ id: string; status: string; subject: string; body: string; created_at: string }>`
    select id, status, subject, body, created_at from support_cases
    where profile_id = ${profileId}
    order by created_at desc
    limit 20
  `;
  return {
    year,
    handle: me.handle,
    testMode: true,
    buyerSpentCents: buyerSpent,
    buyerFeesCents: buyerFees,
    buyerTaxCents: buyerTax,
    buyerOrders,
    sellerGrossCents: sellerGross,
    sellerFeesCents: sellerFees,
    sellerNetCents: sellerGross - sellerFees,
    sellerTaxCollectedCents: sellerTax,
    sellerOrders,
    form1099kWatch: sellerGross > FORM_1099K_GROSS_CENTS && sellerOrders > FORM_1099K_COUNT,
    taxByMetro: [...places.values()],
    lines,
    cases: cases.map((c) => ({
      id: c.id,
      status: c.status === "closed" ? "closed" : "open",
      subject: c.subject,
      body: c.body,
      createdAt: c.created_at,
    })),
  };
}

export const getMyStatement = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => statementFor(context.userId));

export const getCustomerStatement = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ handle: z.string().min(2).max(40) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfile(sql, context.userId);
    if (!me.isStaff) throw new Error("Customer lookup is for operators.");
    const handle = data.handle.replace(/^@/, "").trim().toLowerCase();
    const found = await sql<{ id: string }>`select id from profiles where lower(handle) = ${handle} limit 1`;
    if (!found[0]) throw new Error("No handle by that name.");
    return statementFor(found[0].id);
  });

export const openCase = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        subject: z.string().min(3).max(80),
        body: z.string().min(3).max(1000),
        handle: z.string().max(40).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfile(sql, context.userId);
    let profileId = context.userId;
    if (data.handle && me.isStaff) {
      const handle = data.handle.replace(/^@/, "").trim().toLowerCase();
      const found = await sql<{ id: string }>`select id from profiles where lower(handle) = ${handle} limit 1`;
      if (!found[0]) throw new Error("No handle by that name.");
      profileId = found[0].id;
    }
    const open = await sql<{ n: number }>`
      select count(*)::int as n from support_cases where profile_id = ${profileId} and status = ${"open"}
    `;
    if (Number(open[0]?.n ?? 0) >= 5) throw new Error("You already have five open notes. Wait for a reply.");
    const id = crypto.randomUUID();
    await sql`
      insert into support_cases (id, profile_id, opened_by, status, subject, body)
      values (${id}, ${profileId}, ${context.userId}, ${"open"}, ${data.subject.trim()}, ${data.body.trim()})
    `;
    return { id };
  });

export const closeCase = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfile(sql, context.userId);
    if (!me.isStaff) throw new Error("Only support can close a case.");
    await sql`update support_cases set status = ${"closed"} where id = ${data.id}`;
    return { ok: true as const };
  });

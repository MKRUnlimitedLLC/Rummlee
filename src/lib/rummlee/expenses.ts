import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { TEST_MODE } from "./constants";
import {
  EXPENSE_CATEGORIES,
  classifyExpense,
  expenseLabel,
  type ExpenseCategory,
} from "./expenses-policy";

type Sql = Awaited<ReturnType<typeof getSql>>;

async function requireStaff(sql: Sql, userId: string) {
  const rows = await sql<{ is_staff: boolean; deleted_at: string | null }>`
    select is_staff, deleted_at from profiles where id = ${userId}
  `;
  const me = rows[0];
  if (!me || me.deleted_at || !me.is_staff) throw new Error("Corporate desk is for operators.");
}

async function ensureExpenses(sql: Sql) {
  await sql`
    create table if not exists company_expenses (
      id text primary key,
      spent_on date not null,
      payee text not null,
      category text not null,
      amount_cents integer not null check (amount_cents > 0),
      business_purpose text not null,
      paid_by text not null,
      has_receipt boolean not null default false,
      test_mode boolean not null default true,
      voided_at timestamptz,
      created_by text,
      created_at timestamptz not null default now()
    )
  `;
}

const category = z.enum(EXPENSE_CATEGORIES);

function csvCell(value: string | number | boolean) {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export const listCompanyExpenses = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const userId = context.userId;
    if (!userId) return [];
    await requireStaff(sql, userId);
    await ensureExpenses(sql);
    const rows = await sql<{
      id: string;
      spent_on: string;
      payee: string;
      category: ExpenseCategory;
      amount_cents: number;
      business_purpose: string;
      paid_by: "company" | "founder";
      has_receipt: boolean;
      test_mode: boolean;
      voided_at: string | null;
    }>`
      select id, spent_on::text, payee, category, amount_cents, business_purpose, paid_by, has_receipt, test_mode, voided_at::text
      from company_expenses
      order by spent_on desc, created_at desc
      limit 100
    `;
    return rows.map((row) => {
      const classified = classifyExpense({
        category: row.category,
        amountCents: row.amount_cents,
        hasReceipt: row.has_receipt,
        businessPurpose: row.business_purpose,
        paidBy: row.paid_by,
      });
      return {
        id: row.id,
        spentOn: row.spent_on,
        payee: row.payee,
        category: row.category,
        label: expenseLabel(row.category),
        amountCents: row.amount_cents,
        purpose: row.business_purpose,
        paidBy: row.paid_by,
        hasReceipt: row.has_receipt,
        testMode: row.test_mode,
        voided: Boolean(row.voided_at),
        deductibleCents: classified.ok && !row.voided_at ? classified.row.deductibleCents : 0,
        note: classified.ok ? classified.row.note : "",
      };
    });
  });

export const addCompanyExpense = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        payee: z.string().trim().min(2).max(120),
        category,
        amountCents: z.number().int().positive().max(100_000_000),
        businessPurpose: z.string().trim().min(15).max(400),
        paidBy: z.enum(["company", "founder"]),
        hasReceipt: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const userId = context.userId;
    if (!userId) throw new Error("Sign in required.");
    await requireStaff(sql, userId);
    const classified = classifyExpense(data);
    if (!classified.ok) throw new Error(classified.error);
    await ensureExpenses(sql);
    const id = crypto.randomUUID();
    await sql`
      insert into company_expenses (
        id, spent_on, payee, category, amount_cents, business_purpose, paid_by, has_receipt, test_mode, created_by
      ) values (
        ${id},
        ${data.spentOn},
        ${data.payee},
        ${data.category},
        ${data.amountCents},
        ${data.businessPurpose.trim()},
        ${data.paidBy},
        ${data.hasReceipt},
        ${TEST_MODE},
        ${userId}
      )
    `;
    return { id, deductibleCents: classified.row.deductibleCents, note: classified.row.note };
  });

export const voidCompanyExpense = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const userId = context.userId;
    if (!userId) throw new Error("Sign in required.");
    await requireStaff(sql, userId);
    await ensureExpenses(sql);
    await sql`update company_expenses set voided_at = now() where id = ${data.id} and voided_at is null`;
    return { ok: true as const };
  });

export const exportCompanyExpenses = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ mode: z.enum(["live", "beta"]).optional() }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const userId = context.userId;
    if (!userId) throw new Error("Sign in required.");
    await requireStaff(sql, userId);
    await ensureExpenses(sql);
    const testFlag = (data.mode ?? "live") === "beta";
    const rows = await sql<{
      spent_on: string;
      payee: string;
      category: ExpenseCategory;
      amount_cents: number;
      business_purpose: string;
      paid_by: "company" | "founder";
      has_receipt: boolean;
      test_mode: boolean;
      voided_at: string | null;
    }>`
      select spent_on::text, payee, category, amount_cents, business_purpose, paid_by, has_receipt, test_mode, voided_at::text
      from company_expenses
      where test_mode = ${testFlag}
      order by spent_on, payee
    `;
    const header = [
      "spent_on",
      "payee",
      "category",
      "treatment",
      "amount_cents",
      "deductible_cents",
      "parked_cents",
      "blocked_cents",
      "business_purpose",
      "paid_by",
      "has_receipt",
      "needs_1099",
      "qre",
      "test_mode",
      "voided",
      "note",
    ];
    const lines = [header.join(",")];
    for (const row of rows) {
      const classified = classifyExpense({
        category: row.category,
        amountCents: row.amount_cents,
        hasReceipt: row.has_receipt,
        businessPurpose: row.business_purpose,
        paidBy: row.paid_by,
      });
      const item = classified.ok
        ? classified.row
        : {
            treatment: "rejected",
            deductibleCents: 0,
            parkedCents: 0,
            blockedCents: row.amount_cents,
            needs1099: false,
            qre: false,
            note: "error" in classified ? classified.error : "",
          };
      const voided = Boolean(row.voided_at);
      lines.push(
        [
          row.spent_on,
          row.payee,
          row.category,
          item.treatment,
          row.amount_cents,
          voided ? 0 : item.deductibleCents,
          voided ? 0 : item.parkedCents,
          voided ? 0 : item.blockedCents,
          row.business_purpose,
          row.paid_by,
          row.has_receipt,
          item.needs1099,
          item.qre,
          row.test_mode,
          voided,
          item.note,
        ]
          .map(csvCell)
          .join(","),
      );
    }
    const mode = testFlag ? "beta" : "live";
    return {
      filename: `company_expenses_${mode}.csv`,
      csv: `${lines.join("\n")}\n`,
    };
  });

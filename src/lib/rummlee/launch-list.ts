import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

import { normalizeLaunchEmail } from "./launch-email";

async function ensureLaunchList(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql`
    create table if not exists launch_signups (
      id text primary key,
      email text not null unique,
      created_at timestamptz not null default now()
    )
  `;
}

export const joinLaunchList = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        email: z.string().max(254),
        company: z.string().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    if (data.company && data.company.trim()) return { ok: true as const };
    const email = normalizeLaunchEmail(data.email);
    if (!email) throw new Error("Enter a real email address.");
    const sql = await getSql();
    await ensureLaunchList(sql);
    await sql`
      insert into launch_signups (id, email)
      values (${crypto.randomUUID()}, ${email})
      on conflict (email) do nothing
    `;
    return { ok: true as const };
  });

export const exportLaunchList = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ is_staff: boolean; deleted_at: string | null }>`
      select is_staff, deleted_at from profiles where id = ${context.userId}
    `;
    const me = rows[0];
    if (!me || me.deleted_at || !me.is_staff) throw new Error("Corporate desk is for operators.");
    await ensureLaunchList(sql);
    const list = await sql<{ email: string; created_at: string }>`
      select email, created_at::text from launch_signups order by created_at
    `;
    const lines = ["email,signed_up_at", ...list.map((row) => `${row.email},${row.created_at}`)];
    return { filename: "launch_signups.csv", csv: `${lines.join("\n")}\n`, count: list.length };
  });

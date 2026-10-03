import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { MEASURE_EVENTS } from "./measure";

async function ensureMeasures(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql`
    create table if not exists rummlee_measures (
      id text primary key,
      event text not null,
      path text not null,
      utm_source text,
      utm_medium text,
      utm_campaign text,
      utm_content text,
      created_at timestamptz not null default now()
    )
  `;
}

export const recordMeasure = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        event: z.enum(MEASURE_EVENTS),
        path: z.string().max(80),
        utm_source: z.string().max(40).nullable(),
        utm_medium: z.string().max(40).nullable(),
        utm_campaign: z.string().max(40).nullable(),
        utm_content: z.string().max(40).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    if (!data.path.startsWith("/") || data.path.includes("?")) return { ok: false as const };
    const sql = await getSql();
    await ensureMeasures(sql);
    await sql`
      insert into rummlee_measures (id, event, path, utm_source, utm_medium, utm_campaign, utm_content)
      values (
        ${crypto.randomUUID()},
        ${data.event},
        ${data.path},
        ${data.utm_source},
        ${data.utm_medium},
        ${data.utm_campaign},
        ${data.utm_content}
      )
    `;
    return { ok: true as const };
  });

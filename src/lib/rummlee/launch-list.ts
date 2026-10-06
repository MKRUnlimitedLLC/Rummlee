import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { clientKeyFromHeaders, launchRateAllows } from "./launch-rate";

import {
  handoffSuccess,
  launchSignupCsv,
  ownershipSuccess,
  parseHandoff,
  parseOwnership,
  parseWaitlist,
  waitlistSuccess,
  type LaunchExportRow,
  type LaunchPath,
} from "./launch-capture";

async function ensureLaunchList(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql`
    create table if not exists launch_signups (
      id text primary key,
      email text,
      created_at timestamptz not null default now(),
      path text not null default 'waitlist',
      phone text,
      intent text,
      city text,
      zip text,
      business_name text,
      contact_name text,
      store_type text,
      why_us text,
      hours text,
      parking text,
      source text,
      dedupe text
    )
  `;
  await sql`alter table launch_signups add column if not exists path text not null default 'waitlist'`;
  await sql`alter table launch_signups add column if not exists phone text`;
  await sql`alter table launch_signups add column if not exists intent text`;
  await sql`alter table launch_signups add column if not exists city text`;
  await sql`alter table launch_signups add column if not exists zip text`;
  await sql`alter table launch_signups add column if not exists business_name text`;
  await sql`alter table launch_signups add column if not exists contact_name text`;
  await sql`alter table launch_signups add column if not exists store_type text`;
  await sql`alter table launch_signups add column if not exists why_us text`;
  await sql`alter table launch_signups add column if not exists hours text`;
  await sql`alter table launch_signups add column if not exists parking text`;
  await sql`alter table launch_signups add column if not exists source text`;
  await sql`alter table launch_signups add column if not exists dedupe text`;
  await sql`alter table launch_signups add column if not exists utm_source text`;
  await sql`alter table launch_signups add column if not exists utm_medium text`;
  await sql`alter table launch_signups add column if not exists utm_campaign text`;
  await sql`alter table launch_signups add column if not exists utm_content text`;
  await sql`alter table launch_signups add column if not exists utm_term text`;
  await sql`alter table launch_signups alter column email drop not null`;
  await sql`
    update launch_signups
    set dedupe = 'waitlist:' || lower(email)
    where dedupe is null
      and email is not null
      and path = 'waitlist'
  `;
  await sql`alter table launch_signups drop constraint if exists launch_signups_email_key`;
  await sql`create unique index if not exists launch_signups_dedupe_key on launch_signups (dedupe)`;
  await sql`
    create table if not exists launch_rate_hits (
      id text primary key,
      client_key text not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists launch_rate_hits_client_created on launch_rate_hits (client_key, created_at)`;
}

async function requestClientKey() {
  try {
    return await clientKeyFromHeaders(getRequest().headers);
  } catch {
    return null;
  }
}

async function assertLaunchRate(sql: Awaited<ReturnType<typeof getSql>>, key: string) {
  await sql`delete from launch_rate_hits where created_at < now() - interval '2 days'`;
  const counts = await sql<{ hour_n: number; day_n: number }>`
    select
      count(*) filter (where created_at > now() - interval '1 hour')::int as hour_n,
      count(*) filter (where created_at > now() - interval '1 day')::int as day_n
    from launch_rate_hits
    where client_key = ${key}
  `;
  const hour = Number(counts[0]?.hour_n ?? 0);
  const day = Number(counts[0]?.day_n ?? 0);
  if (!launchRateAllows(hour, day)) {
    throw new Error("Too many submissions from this network. Wait about an hour and try again.");
  }
  await sql`insert into launch_rate_hits (id, client_key) values (${crypto.randomUUID()}, ${key})`;
}

const payload = z.object({
  company: z.string().max(200).optional(),
  path: z
    .enum(["waitlist", "handoff_location", "ownership_interest"])
    .optional(),
  utmSource: z.string().max(500).optional(),
  utmMedium: z.string().max(500).optional(),
  utmCampaign: z.string().max(500).optional(),
  utmContent: z.string().max(500).optional(),
  utmTerm: z.string().max(500).optional(),
  email: z.string().max(254).optional(),
  phone: z.string().max(40).optional(),
  intent: z.string().max(20).optional(),
  city: z.string().max(80).optional(),
  zip: z.string().max(12).optional(),
  businessName: z.string().max(120).optional(),
  contactName: z.string().max(120).optional(),
  storeType: z.string().max(40).optional(),
  whyUs: z.string().max(500).optional(),
  hours: z.string().max(160).optional(),
  parking: z.string().max(160).optional(),
});

function honeypotMessage(
  path: LaunchPath | undefined,
  city: string | undefined,
) {
  const place = (city ?? "").replace(/\s+/g, " ").trim();
  if (path === "handoff_location")
    return handoffSuccess(
      place.length >= 2 && place.length <= 80 ? place : "your city",
    );
  if (path === "ownership_interest") return ownershipSuccess();
  return waitlistSuccess(place.length >= 2 ? place : null);
}

export const joinLaunchList = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = payload.safeParse(data);
    if (!parsed.success) throw new Error("Check the form and try again.");
    return parsed.data;
  })
  .handler(async ({ data }) => {
    if (data.company && data.company.trim()) {
      return {
        ok: true as const,
        message: honeypotMessage(data.path, data.city),
      };
    }
    const parsed =
      data.path === "handoff_location"
        ? parseHandoff(data)
        : data.path === "ownership_interest"
          ? parseOwnership(data)
          : parseWaitlist(data);
    if (!parsed.ok) throw new Error(parsed.error);
    const row = parsed.record;
    const sql = await getSql();
    await ensureLaunchList(sql);
    const clientKey = await requestClientKey();
    if (clientKey) await assertLaunchRate(sql, clientKey);
    await sql`
      insert into launch_signups (
        id, email, phone, path, intent, city, zip,
        business_name, contact_name, store_type, why_us, hours, parking,
        source, dedupe,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term
      ) values (
        ${crypto.randomUUID()}, ${row.email}, ${row.phone}, ${row.path}, ${row.intent}, ${row.city}, ${row.zip},
        ${row.businessName}, ${row.contactName}, ${row.storeType}, ${row.whyUs}, ${row.hours}, ${row.parking},
        ${row.source}, ${row.dedupe},
        ${row.utmSource}, ${row.utmMedium}, ${row.utmCampaign}, ${row.utmContent}, ${row.utmTerm}
      )
      on conflict (dedupe) do update set
        email = excluded.email,
        phone = excluded.phone,
        intent = excluded.intent,
        city = excluded.city,
        zip = excluded.zip,
        business_name = excluded.business_name,
        contact_name = excluded.contact_name,
        store_type = excluded.store_type,
        why_us = excluded.why_us,
        hours = excluded.hours,
        parking = excluded.parking,
        source = case
          when lower(coalesce(excluded.utm_source, launch_signups.utm_source, '')) = 'meta' then 'meta'
          when excluded.utm_source is not null then excluded.source
          else coalesce(launch_signups.source, excluded.source)
        end,
        utm_source = coalesce(excluded.utm_source, launch_signups.utm_source),
        utm_medium = coalesce(excluded.utm_medium, launch_signups.utm_medium),
        utm_campaign = coalesce(excluded.utm_campaign, launch_signups.utm_campaign),
        utm_content = coalesce(excluded.utm_content, launch_signups.utm_content),
        utm_term = coalesce(excluded.utm_term, launch_signups.utm_term)
    `;
    return { ok: true as const, message: parsed.message };
  });

export const exportLaunchList = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ is_staff: boolean; deleted_at: string | null }>`
      select is_staff, deleted_at from profiles where id = ${context.userId}
    `;
    const me = rows[0];
    if (!me || me.deleted_at || !me.is_staff)
      throw new Error("Corporate desk is for operators.");
    await ensureLaunchList(sql);
    const list = await sql<LaunchExportRow>`
      select
        created_at::text as signed_up_at,
        path,
        email,
        phone,
        intent,
        city,
        zip,
        business_name,
        contact_name,
        store_type,
        why_us,
        hours,
        parking,
        source,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term
      from launch_signups
      order by created_at, id
    `;
    return {
      filename: "launch_signups.csv",
      csv: launchSignupCsv(list),
      count: list.length,
    };
  });

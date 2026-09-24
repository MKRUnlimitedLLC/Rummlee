import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { writeNotice } from "./books";
import { CITIES, HAULS } from "./constants";
import { cityOf, fitsOfficialCounter, money, saleIsUpcoming } from "./format";

type Sql = Awaited<ReturnType<typeof getSql>>;

export type PlusAlert = {
  enabled: boolean;
  instant: boolean;
  categories: string[];
  officialOn: boolean;
  spotId: string | null;
  inPersonOn: boolean;
  keyword: string;
  maxPriceCents: number | null;
  hauls: Array<"bag" | "one" | "two" | "truck">;
  sizeLabel: string;
  counterOnly: boolean;
  weekendOnly: boolean;
  city: string | null;
};

const emptyAlert = (): PlusAlert => ({
  enabled: false,
  instant: false,
  categories: [],
  officialOn: false,
  spotId: null,
  inPersonOn: false,
  keyword: "",
  maxPriceCents: null,
  hauls: [],
  sizeLabel: "",
  counterOnly: false,
  weekendOnly: false,
  city: null,
});

export async function ensurePlusAlerts(sql: Sql) {
  await sql`
    create table if not exists plus_alerts (
      user_id text primary key,
      enabled boolean not null default false,
      instant boolean not null default false,
      categories text not null default '',
      official_on boolean not null default false,
      spot_id text,
      in_person_on boolean not null default false,
      keyword text not null default '',
      max_price_cents integer,
      hauls text not null default '',
      size_label text not null default '',
      counter_only boolean not null default false,
      weekend_only boolean not null default false,
      city text
    )
  `;
  await sql`
    create table if not exists plus_alert_seen (
      user_id text not null,
      ref_id text not null,
      kind text not null,
      primary key (user_id, ref_id, kind)
    )
  `;
  await sql`
    create table if not exists plus_alert_queue (
      id text primary key,
      user_id text not null,
      title text not null,
      body text not null,
      ref_id text,
      created_at timestamptz not null default now(),
      sent_at timestamptz
    )
  `;
}

function list(value: string) {
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

function hasListingTrigger(alert: PlusAlert) {
  return Boolean(
    alert.categories.length ||
      alert.officialOn ||
      alert.keyword.trim() ||
      alert.maxPriceCents ||
      alert.hauls.length ||
      alert.sizeLabel.trim() ||
      alert.counterOnly ||
      alert.weekendOnly,
  );
}

function centralHour(now = new Date()) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    hour12: false,
  }).format(now);
  return Number(hour);
}

function inQuietHours(now = new Date()) {
  const hour = centralHour(now);
  return hour >= 21 || hour < 8;
}

function withinWeek(iso: string) {
  const end = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime();
  const today = new Date();
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return end >= start && end <= start + 7 * 86400000;
}

type Hit = {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  priceCents: number;
  category: string;
  haul: string;
  sizeLabel: string | null;
  pack: string | null;
  weightLbs: number | null;
  neighborhood: string;
  modes: string;
  liveOn: boolean;
  endsOn: string;
  spotId: string | null;
  spotName: string | null;
  spotKind: string | null;
};

function matchesListing(alert: PlusAlert, hit: Hit) {
  if (!alert.enabled || !hasListingTrigger(alert)) return false;
  const city = alert.city?.trim();
  if (city && cityOf(hit.neighborhood) !== city) return false;
  if (alert.categories.length && !alert.categories.includes(hit.category)) return false;
  const modes = hit.modes.split(",");
  if (alert.officialOn && !modes.includes("official")) return false;
  if (alert.officialOn && alert.spotId && hit.spotId !== alert.spotId) return false;
  if (alert.keyword.trim()) {
    const hay = `${hit.title} ${hit.description}`.toLowerCase();
    if (!hay.includes(alert.keyword.trim().toLowerCase())) return false;
  }
  if (alert.maxPriceCents && hit.priceCents > alert.maxPriceCents) return false;
  if (alert.hauls.length && !alert.hauls.some((haul) => haul === hit.haul)) return false;
  if (alert.sizeLabel.trim() && (hit.sizeLabel ?? "").toLowerCase() !== alert.sizeLabel.trim().toLowerCase()) return false;
  if (alert.counterOnly && !fitsOfficialCounter(hit)) return false;
  if (alert.weekendOnly && !(hit.liveOn && withinWeek(hit.endsOn))) return false;
  return true;
}

function handoffLine(hit: Hit) {
  const modes = hit.modes.split(",");
  const parts: string[] = [];
  if (modes.includes("official")) parts.push(hit.spotName && hit.spotKind === "partner" ? hit.spotName : "Official store handoff");
  if (modes.includes("public")) parts.push("Public place handoff");
  if (modes.includes("person")) parts.push("In person handoff");
  return parts.join(" · ") || "Handoff location";
}

function listingBody(hit: Hit) {
  return `${money(hit.priceCents)} · ${cityOf(hit.neighborhood)} · ${handoffLine(hit)}`;
}

async function deliver(sql: Sql, userId: string, instant: boolean, title: string, body: string, refId: string) {
  if (instant && !inQuietHours()) {
    await writeNotice(sql, { userId, kind: "alert", title, body, refId });
    return;
  }
  await sql`
    insert into plus_alert_queue (id, user_id, title, body, ref_id)
    values (${crypto.randomUUID()}, ${userId}, ${title}, ${body}, ${refId})
  `;
}

async function claim(sql: Sql, userId: string, refId: string, kind: string) {
  const won = await sql<{ user_id: string }>`
    insert into plus_alert_seen (user_id, ref_id, kind)
    values (${userId}, ${refId}, ${kind})
    on conflict (user_id, ref_id, kind) do nothing
    returning user_id
  `;
  return Boolean(won[0]);
}

type AlertSql = PlusAlert & { userId: string; instant: boolean };

function mapRow(row: {
  user_id: string;
  enabled: boolean;
  instant: boolean;
  categories: string;
  official_on: boolean;
  spot_id: string | null;
  in_person_on: boolean;
  keyword: string;
  max_price_cents: number | null;
  hauls: string;
  size_label: string;
  counter_only: boolean;
  weekend_only: boolean;
  city: string | null;
}): AlertSql {
  return {
    userId: row.user_id,
    enabled: row.enabled,
    instant: row.instant,
    categories: list(row.categories ?? ""),
    officialOn: row.official_on,
    spotId: row.spot_id,
    inPersonOn: row.in_person_on,
    keyword: row.keyword ?? "",
    maxPriceCents: row.max_price_cents == null ? null : Number(row.max_price_cents),
    hauls: list(row.hauls ?? "").filter((id): id is "bag" | "one" | "two" | "truck" =>
      id === "bag" || id === "one" || id === "two" || id === "truck",
    ),
    sizeLabel: row.size_label ?? "",
    counterOnly: row.counter_only,
    weekendOnly: row.weekend_only,
    city: row.city,
  };
}

async function loadEnabled(sql: Sql) {
  const rows = await sql<{
    user_id: string;
    enabled: boolean;
    instant: boolean;
    categories: string;
    official_on: boolean;
    spot_id: string | null;
    in_person_on: boolean;
    keyword: string;
    max_price_cents: number | null;
    hauls: string;
    size_label: string;
    counter_only: boolean;
    weekend_only: boolean;
    city: string | null;
  }>`
    select a.user_id, a.enabled, a.instant, a.categories, a.official_on, a.spot_id, a.in_person_on,
           a.keyword, a.max_price_cents, a.hauls, a.size_label, a.counter_only, a.weekend_only,
           coalesce(a.city, p.city) as city
    from plus_alerts a
    join profiles p on p.id = a.user_id
    where a.enabled = true and p.is_premium = true and p.deleted_at is null
  `;
  return rows.map(mapRow);
}

export async function notifyNewListing(sql: Sql, listingId: string) {
  await ensurePlusAlerts(sql);
  const rows = await sql<{
    id: string;
    seller_id: string;
    title: string;
    description: string;
    price_cents: number;
    category: string;
    haul: string;
    size_label: string | null;
    pack: string | null;
    weight_lbs: number | null;
    neighborhood: string;
    handoff_modes: string;
    ends_on: string;
    starts_on: string;
    always_on: boolean | null;
    live_on: boolean | null;
    handoff_spot_id: string | null;
    spot_name: string | null;
    spot_kind: string | null;
  }>`
    select l.id, l.seller_id, l.title, l.description, l.price_cents, l.category, l.haul, l.size_label,
           l.pack, l.weight_lbs, l.neighborhood, l.handoff_modes, s.ends_on::text, s.starts_on::text, s.always_on, s.live_on, s.handoff_spot_id,
           hs.name as spot_name, hs.kind as spot_kind
    from listings l
    join sales s on s.id = l.sale_id
    left join handoff_spots hs on hs.id = s.handoff_spot_id
    where l.id = ${listingId} and l.status = ${"live"}
  `;
  const row = rows[0];
  if (!row || row.seller_id.startsWith("seed-") || row.seller_id.startsWith("house-")) return;
  if (saleIsUpcoming(String(row.starts_on), Boolean(row.always_on))) return;
  const hit: Hit = {
    id: row.id,
    sellerId: row.seller_id,
    title: row.title,
    description: row.description ?? "",
    priceCents: Number(row.price_cents),
    category: row.category,
    haul: row.haul,
    sizeLabel: row.size_label,
    pack: row.pack,
    weightLbs: row.weight_lbs == null ? null : Number(row.weight_lbs),
    neighborhood: row.neighborhood,
    modes: row.handoff_modes,
    liveOn: Boolean(row.live_on),
    endsOn: String(row.ends_on),
    spotId: row.handoff_spot_id,
    spotName: row.spot_name,
    spotKind: row.spot_kind,
  };
  for (const alert of await loadEnabled(sql)) {
    if (alert.userId === hit.sellerId) continue;
    if (!matchesListing(alert, hit)) continue;
    if (!(await claim(sql, alert.userId, hit.id, "listing"))) continue;
    await deliver(sql, alert.userId, alert.instant, hit.title, listingBody(hit), hit.id);
  }
}

export async function notifyNewSale(sql: Sql, saleId: string) {
  await ensurePlusAlerts(sql);
  const rows = await sql<{
    id: string;
    seller_id: string;
    name: string;
    neighborhood: string;
    live_on: boolean | null;
    ends_on: string;
    always_on: boolean | null;
  }>`
    select id, seller_id, name, neighborhood, live_on, ends_on::text, always_on
    from sales where id = ${saleId} and status = ${"live"}
  `;
  const sale = rows[0];
  if (!sale || !sale.live_on || sale.always_on) return;
  if (sale.seller_id.startsWith("seed-") || sale.seller_id.startsWith("house-")) return;
  const city = cityOf(sale.neighborhood);
  for (const alert of await loadEnabled(sql)) {
    if (!alert.inPersonOn || alert.userId === sale.seller_id) continue;
    if (alert.city && alert.city !== city) continue;
    if (!(await claim(sql, alert.userId, sale.id, "sale"))) continue;
    await deliver(
      sql,
      alert.userId,
      alert.instant,
      sale.name,
      `Private handoff · ${city}. About the distance until you pay. The address stays off this alert.`,
      sale.id,
    );
  }
}

export async function flushPlusDigests(sql: Sql) {
  await ensurePlusAlerts(sql);
  const rows = await sql<{ id: string; user_id: string; title: string; body: string }>`
    select id, user_id, title, body from plus_alert_queue
    where sent_at is null
    order by created_at
    limit 200
  `;
  const byUser = new Map<string, { ids: string[]; lines: string[] }>();
  for (const row of rows) {
    const bag = byUser.get(row.user_id) ?? { ids: [], lines: [] };
    bag.ids.push(row.id);
    if (bag.lines.length < 8) bag.lines.push(`${row.title} — ${row.body}`);
    byUser.set(row.user_id, bag);
  }
  let sent = 0;
  for (const [userId, bag] of byUser) {
    const extra = bag.ids.length > bag.lines.length ? ` and ${bag.ids.length - bag.lines.length} more` : "";
    await writeNotice(sql, {
      userId,
      kind: "alert",
      title: bag.ids.length === 1 ? "Plus alert" : `Plus alerts · ${bag.ids.length} new`,
      body: `${bag.lines.join("\n")}${extra}`,
      refId: null,
    });
    for (const id of bag.ids) {
      await sql`update plus_alert_queue set sent_at = now() where id = ${id}`;
    }
    sent += 1;
  }
  return sent;
}

const saveInput = z.object({
  enabled: z.boolean(),
  instant: z.boolean(),
  categories: z.array(z.string().max(40)).max(12),
  officialOn: z.boolean(),
  spotId: z.string().max(80).nullable(),
  inPersonOn: z.boolean(),
  keyword: z.string().max(40),
  maxPriceCents: z.number().int().min(100).max(500000).nullable(),
  hauls: z.array(z.enum(["bag", "one", "two", "truck"])).max(4),
  sizeLabel: z.string().max(20),
  counterOnly: z.boolean(),
  weekendOnly: z.boolean(),
  city: z.string().max(40).nullable(),
});

export const getPlusAlert = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensurePlusAlerts(sql);
    const profile = await sql<{ is_premium: boolean; city: string | null }>`
      select is_premium, city from profiles where id = ${context.userId}
    `;
    const rows = await sql<{
      user_id: string;
      enabled: boolean;
      instant: boolean;
      categories: string;
      official_on: boolean;
      spot_id: string | null;
      in_person_on: boolean;
      keyword: string;
      max_price_cents: number | null;
      hauls: string;
      size_label: string;
      counter_only: boolean;
      weekend_only: boolean;
      city: string | null;
    }>`select * from plus_alerts where user_id = ${context.userId}`;
    const spots = await sql<{ id: string; name: string; area: string }>`
      select id, name, area from handoff_spots where kind = ${"partner"} order by name
    `;
    const stored = rows[0] ? mapRow(rows[0]) : { ...emptyAlert(), userId: context.userId, city: profile[0]?.city ?? null };
    return {
      plus: Boolean(profile[0]?.is_premium),
      alert: stored,
      spots,
      cities: CITIES,
      hauls: HAULS,
    };
  });

export const savePlusAlert = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => saveInput.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensurePlusAlerts(sql);
    const profile = await sql<{ is_premium: boolean }>`select is_premium from profiles where id = ${context.userId}`;
    if (!profile[0]?.is_premium) throw new Error("Plus alerts are included with Plus and +++.");
    const triggers =
      data.categories.length ||
      data.officialOn ||
      data.inPersonOn ||
      data.keyword.trim() ||
      data.maxPriceCents ||
      data.hauls.length ||
      data.sizeLabel.trim() ||
      data.counterOnly ||
      data.weekendOnly;
    if (data.enabled && !triggers) throw new Error("Pick at least one filter. City alone does not send alerts.");
    if (data.city && !(CITIES as readonly string[]).includes(data.city)) throw new Error("Pick a city from the list.");
    await sql`
      insert into plus_alerts (
        user_id, enabled, instant, categories, official_on, spot_id, in_person_on, keyword,
        max_price_cents, hauls, size_label, counter_only, weekend_only, city
      ) values (
        ${context.userId}, ${data.enabled}, ${data.instant}, ${data.categories.join(",")}, ${data.officialOn},
        ${data.officialOn ? data.spotId : null}, ${data.inPersonOn}, ${data.keyword.trim()},
        ${data.maxPriceCents}, ${data.hauls.join(",")}, ${data.sizeLabel.trim()}, ${data.counterOnly},
        ${data.weekendOnly}, ${data.city}
      )
      on conflict (user_id) do update set
        enabled = excluded.enabled,
        instant = excluded.instant,
        categories = excluded.categories,
        official_on = excluded.official_on,
        spot_id = excluded.spot_id,
        in_person_on = excluded.in_person_on,
        keyword = excluded.keyword,
        max_price_cents = excluded.max_price_cents,
        hauls = excluded.hauls,
        size_label = excluded.size_label,
        counter_only = excluded.counter_only,
        weekend_only = excluded.weekend_only,
        city = excluded.city
    `;
    return { ok: true as const };
  });

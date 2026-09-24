import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { CATEGORIES, TRIO_RESEARCHES_PER_MONTH } from "./constants";
import { feeById, DEFAULT_FEES } from "./fees";
import { storePhoto } from "./photo-store";
import { grantRep } from "./rep";
import { ensureSeed } from "./seed";
import { writeLedger, writeNotice } from "./books";

type Sql = Awaited<ReturnType<typeof getSql>>;

const categoryIds = CATEGORIES.map((row) => row.id) as [string, ...string[]];

function safePhoto(url: string) {
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(url) && url.length < 1_500_000) return url;
  if (url.startsWith("http") && url.length < 500) return url;
  throw new Error("Use a JPEG, PNG, or WebP photo.");
}

async function take(sql: Sql, userId: string, cents: number) {
  if (cents <= 0) return;
  const rows = await sql<{ id: string }>`
    update profiles set wallet_cents = wallet_cents - ${cents}
    where id = ${userId} and wallet_cents >= ${cents}
    returning id
  `;
  if (!rows[0]) throw new Error("Not enough in the wallet for that.");
}

async function give(sql: Sql, userId: string, cents: number, kind: string, refId: string, note: string) {
  if (cents <= 0) return;
  await sql`update profiles set wallet_cents = wallet_cents + ${cents} where id = ${userId}`;
  await sql`
    insert into wallet_tx (id, user_id, kind, amount_cents, ref_id, note)
    values (${crypto.randomUUID()}, ${userId}, ${kind}, ${cents}, ${refId}, ${note})
  `;
}

async function feeCents(sql: Sql, id: "research_ask" | "research_pay" | "research_range_bonus" | "research_asking_bonus") {
  const rows = await sql<{ id: string; amount_cents: number; unit: string; enabled: boolean }>`
    select id, amount_cents, unit, enabled from rummlee_fees where id = ${id}
  `;
  const row = rows[0];
  if (!row || !row.enabled || row.unit === "none") return 0;
  return Math.max(0, Number(row.amount_cents) || 0);
}

async function releaseExpiredClaims(sql: Sql) {
  await sql`
    update research_requests
    set status = ${"open"}, researcher_id = null, claimed_at = null, due_at = null, held_at = null
    where status = ${"claimed"} and paused_at is null and due_at is not null and due_at <= now() - interval '5 minutes'
  `;
}

export const getResearchDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureSeed(sql);
    await releaseExpiredClaims(sql);
    const me = await sql<{ is_researcher: boolean; wallet_cents: number; is_premium: boolean; plus_tier: string | null; plus_until: string | null }>`
      select coalesce(is_researcher, false) as is_researcher, wallet_cents, is_premium, plus_tier, plus_until
      from profiles where id = ${context.userId}
    `;
    const ask = await feeCents(sql, "research_ask");
    const pay = Math.min(await feeCents(sql, "research_pay"), ask);
    const person = me[0];
    const trio = Boolean(person?.is_premium) && person?.plus_tier === "trio" && (!person.plus_until || new Date(person.plus_until).getTime() > Date.now());
    const used = trio
      ? await sql<{ n: number }>`
          select count(*)::int as n from research_requests
          where seller_id = ${context.userId} and status <> ${"cancelled"} and created_at >= date_trunc('month', now())
        `
      : [];
    const includedLeft = trio ? Math.max(0, TRIO_RESEARCHES_PER_MONTH - Number(used[0]?.n ?? 0)) : 0;
    const mine = await sql<{
      id: string;
      status: string;
      note: string | null;
      charged_cents: number;
      payout_cents: number;
      title: string | null;
      low_cents: number | null;
      high_cents: number | null;
      handle: string | null;
      created_at: string;
    }>`
      select r.id, r.status, r.note, r.charged_cents, r.payout_cents, r.title, r.low_cents, r.high_cents,
             p.handle, r.created_at
      from research_requests r
      left join profiles p on p.id = r.researcher_id
      where r.seller_id = ${context.userId}
      order by r.created_at desc
      limit 20
    `;
    const isResearcher = Boolean(me[0]?.is_researcher);
    const queue = isResearcher
      ? await sql<{ id: string; note: string | null; status: string; created_at: string; ask_category: string | null; due_at: string | null }>`
          select r.id, r.note, r.status, r.created_at, r.ask_category, r.due_at
          from research_requests r
          where r.seller_id <> ${context.userId}
            and (
              (
                r.status = ${"open"}
                and (
                  r.ask_category is null
                  or exists (
                    select 1 from researcher_accounts a
                    where a.profile_id = ${context.userId}
                      and (
                        a.areas = ''
                        or (',' || a.areas || ',') like ('%,' || r.ask_category || ',%')
                      )
                  )
                )
              )
              or (r.status = ${"claimed"} and r.researcher_id = ${context.userId})
            )
            and not exists (
              select 1 from research_passes x where x.request_id = r.id and x.researcher_id = ${context.userId}
            )
          order by case when r.status = ${"claimed"} then 0 else 1 end, r.created_at
          limit 20
        `
      : [];
    const accountRows = await sql<{ status: string; city: string; year_cents: number; year_count: number }>`
      select a.status, a.city,
        coalesce((
          select sum(r.payout_cents)::int from research_requests r
          where r.researcher_id = a.profile_id and r.status = ${"accepted"} and r.decided_at >= date_trunc('year', now())
        ), 0) + coalesce((
          select sum(r.range_bonus_cents + r.asking_bonus_cents)::int from research_requests r
          where r.researcher_id = a.profile_id and r.bonus_paid_at >= date_trunc('year', now())
        ), 0) as year_cents,
        coalesce((
          select count(*)::int from research_requests r
          where r.researcher_id = a.profile_id and r.status = ${"accepted"} and r.decided_at >= date_trunc('year', now())
        ), 0) as year_count
      from researcher_accounts a
      where a.profile_id = ${context.userId}
    `;
    const account = accountRows[0];
    return {
      isResearcher,
      walletCents: Number(me[0]?.wallet_cents ?? 0),
      askCents: ask,
      payCents: ask === 0 ? 0 : pay,
      includedLeft,
      account: account
        ? { status: account.status, city: account.city, yearCents: Number(account.year_cents), yearCount: Number(account.year_count) }
        : null,
      mine: mine.map((row) => ({
        id: row.id,
        status: row.status,
        note: row.note,
        chargedCents: Number(row.charged_cents),
        payoutCents: Number(row.payout_cents),
        title: row.title,
        lowCents: row.low_cents == null ? null : Number(row.low_cents),
        highCents: row.high_cents == null ? null : Number(row.high_cents),
        researcher: row.status === "open" || row.status === "cancelled" ? null : row.handle,
        createdAt: String(row.created_at),
      })),
      queue: queue.map((row) => ({
        id: row.id,
        note: row.note,
        status: row.status,
        category: row.ask_category,
        dueAt: row.due_at ? String(row.due_at) : null,
        createdAt: String(row.created_at),
      })),
    };
  });

export const setResearcher = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((on: boolean) => z.boolean().parse(on))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (data) throw new Error("Researchers apply. Open the researcher account on this page.");
    const won = await sql<{ profile_id: string }>`
      update researcher_accounts
      set status = ${"paused"}, decided_at = now()
      where profile_id = ${context.userId} and status = ${"active"}
      returning profile_id
    `;
    if (!won[0]) throw new Error("There isn’t an active researcher account to pause.");
    await sql`update profiles set is_researcher = false where id = ${context.userId}`;
    return { on: false };
  });

export const applyResearcher = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({
      city: z.string().min(2).max(80),
      areas: z.array(z.enum(categoryIds)).min(1),
      skills: z.string().max(240).optional(),
      contractor: z.literal(true),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await sql<{ legal_first_name: string | null; legal_last_name: string | null }>`
      select legal_first_name, legal_last_name from profiles where id = ${context.userId}
    `;
    if (!me[0]?.legal_first_name?.trim() || !me[0]?.legal_last_name?.trim()) {
      throw new Error("Finish your account first. The 1099 uses the legal name already on it. It is not shown on listings.");
    }
    const existing = await sql<{ status: string }>`
      select status from researcher_accounts where profile_id = ${context.userId}
    `;
    if (existing[0]?.status === "active") throw new Error("Your researcher account is already on.");
    if (existing[0]?.status === "paused") throw new Error("Your account is paused. Resume it instead of applying again.");
    const city = data.city.trim();
    const areas = [...new Set(data.areas)].join(",");
    const skills = data.skills?.trim() || data.areas.map((id) => CATEGORIES.find((row) => row.id === id)?.label ?? id).join(", ");
    if (existing[0]) {
      await sql`
        update researcher_accounts
        set status = ${"pending"}, city = ${city}, skills = ${skills}, areas = ${areas}, contractor_ok = true, applied_at = now(), decided_at = null, decided_by = null
        where profile_id = ${context.userId}
      `;
    } else {
      await sql`
        insert into researcher_accounts (profile_id, status, city, skills, areas, contractor_ok)
        values (${context.userId}, ${"pending"}, ${city}, ${skills}, ${areas}, ${true})
      `;
    }
    await sql`update profiles set is_researcher = false where id = ${context.userId}`;
    return { status: "pending" as const };
  });

export const resumeResearcher = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const won = await sql<{ profile_id: string }>`
      update researcher_accounts
      set status = ${"active"}, decided_at = now()
      where profile_id = ${context.userId} and status = ${"paused"}
      returning profile_id
    `;
    if (!won[0]) throw new Error("Nothing to resume.");
    await sql`update profiles set is_researcher = true where id = ${context.userId}`;
    return { on: true as const };
  });

export type ResearcherApp = {
  profileId: string;
  handle: string;
  legalName: string;
  city: string;
  skills: string;
  appliedAt: string;
};

export const getResearcherQueue = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const staff = await sql<{ is_staff: boolean }>`select is_staff from profiles where id = ${context.userId}`;
    if (!staff[0]?.is_staff) return { apps: [] as ResearcherApp[] };
    const rows = await sql<{
      profile_id: string;
      handle: string;
      legal_first_name: string | null;
      legal_last_name: string | null;
      city: string;
      skills: string;
      applied_at: string;
    }>`
      select a.profile_id, p.handle, p.legal_first_name, p.legal_last_name, a.city, a.skills, a.applied_at
      from researcher_accounts a
      join profiles p on p.id = a.profile_id
      where a.status = ${"pending"}
      order by a.applied_at
      limit 40
    `;
    return {
      apps: rows.map((row) => ({
        profileId: row.profile_id,
        handle: row.handle,
        legalName: `${row.legal_first_name ?? ""} ${row.legal_last_name ?? ""}`.trim(),
        city: row.city,
        skills: row.skills,
        appliedAt: String(row.applied_at),
      })),
    };
  });

export const decideResearcher = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ profileId: z.string(), approve: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const staff = await sql<{ is_staff: boolean }>`select is_staff from profiles where id = ${context.userId}`;
    if (!staff[0]?.is_staff) throw new Error("Corporate only.");
    const status = data.approve ? "active" : "denied";
    const won = await sql<{ profile_id: string }>`
      update researcher_accounts
      set status = ${status}, decided_at = now(), decided_by = ${context.userId}
      where profile_id = ${data.profileId} and status = ${"pending"}
      returning profile_id
    `;
    if (!won[0]) throw new Error("That application isn’t waiting.");
    await sql`update profiles set is_researcher = ${data.approve} where id = ${data.profileId}`;
    await writeNotice(sql, {
      userId: data.profileId,
      kind: "research",
      title: data.approve ? "Researcher account is on" : "Researcher application wasn’t accepted",
      body: data.approve
        ? "You can claim photos. Pay is contractor pay, per accepted write-up. Test credits during beta."
        : "You can apply again from the researcher page.",
      refId: data.profileId,
    });
    return { ok: true as const };
  });

export const askResearcher = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({
      note: z.string().max(300).optional(),
      category: z.enum(categoryIds),
      photos: z.array(z.string().min(20).max(1_500_000)).min(1).max(3),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureSeed(sql);
    const tierRow = await sql<{ plus_tier: string | null; is_premium: boolean; plus_until: string | null }>`
      select plus_tier, is_premium, plus_until from profiles where id = ${context.userId}
    `;
    const tier = tierRow[0];
    const trio =
      Boolean(tier?.is_premium) &&
      tier?.plus_tier === "trio" &&
      (!tier.plus_until || new Date(tier.plus_until).getTime() > Date.now());
    const used = await sql<{ n: number }>`
      select count(*)::int as n from research_requests
      where seller_id = ${context.userId}
        and status <> ${"cancelled"}
        and created_at >= date_trunc('month', now())
    `;
    const freeLeft = trio ? Math.max(0, TRIO_RESEARCHES_PER_MONTH - Number(used[0]?.n ?? 0)) : 0;
    const ask = freeLeft > 0 ? 0 : await feeCents(sql, "research_ask");
    const pay = freeLeft > 0 ? await feeCents(sql, "research_pay") : Math.min(await feeCents(sql, "research_pay"), ask);
    await take(sql, context.userId, ask);
    const id = crypto.randomUUID();
    const photos: string[] = [];
    for (const photo of data.photos) {
      photos.push(await storePhoto(safePhoto(photo), `research/${id}-${photos.length}`));
    }
    const note = data.note?.trim() || null;
    await sql`
      insert into research_requests (id, seller_id, note, photos, status, charged_cents, payout_cents, ask_category)
      values (${id}, ${context.userId}, ${note}, ${JSON.stringify(photos)}, ${"open"}, ${ask}, ${pay}, ${data.category})
    `;
    if (ask > 0) {
      await sql`
        insert into wallet_tx (id, user_id, kind, amount_cents, ref_id, note)
        values (${crypto.randomUUID()}, ${context.userId}, ${"research"}, ${-ask}, ${id}, ${"Ask a researcher"})
      `;
      await writeLedger(sql, { userId: context.userId, account: "fee_research", amountCents: ask, note: "Ask a researcher" });
    }
    const researchers = await sql<{ id: string }>`
      select a.profile_id as id
      from researcher_accounts a
      join profiles p on p.id = a.profile_id
      where a.status = ${"active"}
        and p.deleted_at is null
        and a.profile_id <> ${context.userId}
        and (
          a.areas = ''
          or (',' || a.areas || ',') like ${"%," + data.category + ",%"}
        )
      limit 40
    `;
    const targets = researchers.length
      ? researchers
      : await sql<{ id: string }>`
          select id from profiles
          where is_researcher = true and id <> ${context.userId} and deleted_at is null
          limit 40
        `;
    const label = CATEGORIES.find((row) => row.id === data.category)?.label ?? "An item";
    for (const person of targets) {
      await writeNotice(sql, {
        userId: person.id,
        kind: "research",
        title: `${label} needs a look`,
        body: "Research now starts a 15-minute clock. You can hold one item at a time. You are paid only if the seller accepts it.",
        refId: id,
      });
    }
    return { id };
  });

export const getResearchItem = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await releaseExpiredClaims(sql);
    const rows = await sql<{
      id: string;
      seller_id: string;
      researcher_id: string | null;
      note: string | null;
      photos: string;
      status: string;
      charged_cents: number;
      payout_cents: number;
      title: string | null;
      description: string | null;
      category: string | null;
      condition: string | null;
      low_cents: number | null;
      high_cents: number | null;
      description_mark: string | null;
      accuracy_mark: string | null;
      price_mark: string | null;
      handle: string | null;
      due_at: string | null;
      held_at: string | null;
      paused_at: string | null;
    }>`
      select r.id, r.seller_id, r.researcher_id, r.note, r.photos, r.status, r.charged_cents, r.payout_cents,
             r.title, r.description, r.category, r.condition, r.low_cents, r.high_cents,
             r.description_mark, r.accuracy_mark, r.price_mark, p.handle, r.due_at, r.held_at, r.paused_at
      from research_requests r
      left join profiles p on p.id = r.researcher_id
      where r.id = ${data}
    `;
    const row = rows[0];
    if (!row) throw new Error("That request is gone.");
    const me = await sql<{ is_researcher: boolean }>`select coalesce(is_researcher, false) as is_researcher from profiles where id = ${context.userId}`;
    const seller = row.seller_id === context.userId;
    const researcher = Boolean(me[0]?.is_researcher);
    if (!seller && !researcher) throw new Error("Researchers only.");
    if (!seller && row.status === "accepted" && row.researcher_id !== context.userId) {
      throw new Error("The seller already accepted this.");
    }
    const showAnswer = seller || row.researcher_id === context.userId;
    const party = seller || row.researcher_id === context.userId;
    const thread = party
      ? await sql<{ id: string; author_id: string; body: string | null; photos: string; kind: string; created_at: string }>`
          select id, author_id, body, photos, kind, created_at
          from research_messages
          where request_id = ${row.id}
          order by created_at
        `
      : [];
    const paused = Boolean(row.paused_at);
    return {
      id: row.id,
      mine: seller,
      status: row.status,
      note: row.note,
      photos: JSON.parse(row.photos) as string[],
      chargedCents: Number(row.charged_cents),
      payoutCents: Number(row.payout_cents),
      title: showAnswer ? row.title : null,
      description: showAnswer ? row.description : null,
      category: showAnswer ? row.category : null,
      condition: showAnswer ? row.condition : null,
      lowCents: showAnswer && row.low_cents != null ? Number(row.low_cents) : null,
      highCents: showAnswer && row.high_cents != null ? Number(row.high_cents) : null,
      researcher: showAnswer ? row.handle : null,
      canClaim: researcher && !seller && row.status === "open",
      canAnswer: row.researcher_id === context.userId && row.status === "claimed",
      canAsk: row.researcher_id === context.userId && row.status === "claimed" && !paused,
      canReply: seller && row.status === "claimed" && paused,
      canHold: row.researcher_id === context.userId && row.status === "claimed" && !paused && !row.held_at && row.due_at != null && new Date(row.due_at).getTime() <= Date.now(),
      dueAt: row.researcher_id === context.userId && row.due_at ? String(row.due_at) : null,
      held: Boolean(row.held_at),
      paused,
      messages: thread.map((note) => ({
        id: note.id,
        body: note.body,
        photos: JSON.parse(note.photos) as string[],
        kind: note.kind,
        mine: note.author_id === context.userId,
        createdAt: String(note.created_at),
      })),
      canDecide: seller && row.status === "review",
      canRate: seller && row.status === "accepted" && !row.description_mark,
      canCancel: seller && row.status === "open",
      marks: seller
        ? { description: row.description_mark, accuracy: row.accuracy_mark, price: row.price_mark }
        : null,
    };
  });

export const claimResearch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await sql<{ is_researcher: boolean }>`select coalesce(is_researcher, false) as is_researcher from profiles where id = ${context.userId}`;
    if (!me[0]?.is_researcher) throw new Error("Your researcher account isn’t active yet.");
    await releaseExpiredClaims(sql);
    const busy = await sql<{ id: string }>`
      select id from research_requests
      where researcher_id = ${context.userId} and status = ${"claimed"}
      limit 1
    `;
    if (busy[0]) throw new Error("Finish or release the one you have. One item at a time.");
    const item = await sql<{ ask_category: string | null }>`
      select ask_category from research_requests where id = ${data}
    `;
    if (item[0]?.ask_category) {
      const fit = await sql<{ profile_id: string }>`
        select profile_id from researcher_accounts
        where profile_id = ${context.userId}
          and (
            areas = ''
            or (',' || areas || ',') like ${"%," + item[0].ask_category + ",%"}
          )
      `;
      if (!fit[0]) throw new Error("That product type isn’t one of your areas.");
    }
    const passed = await sql<{ request_id: string }>`
      select request_id from research_passes where request_id = ${data} and researcher_id = ${context.userId}
    `;
    if (passed[0]) throw new Error("The seller already passed on your note for this one.");
    const won = await sql<{ id: string }>`
      update research_requests
      set status = ${"claimed"}, researcher_id = ${context.userId}, claimed_at = now(), due_at = now() + interval '15 minutes', held_at = null
      where id = ${data} and status = ${"open"} and seller_id <> ${context.userId}
      returning id
    `;
    if (!won[0]) throw new Error("Someone else took that one.");
    return { ok: true as const };
  });

export const releaseResearch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const won = await sql<{ id: string }>`
      update research_requests
      set status = ${"open"}, researcher_id = null, claimed_at = null, due_at = null, held_at = null, paused_at = null
      where id = ${data} and status = ${"claimed"} and researcher_id = ${context.userId}
      returning id
    `;
    if (!won[0]) throw new Error("You aren’t holding that one.");
    return { ok: true as const };
  });

export const holdResearch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const won = await sql<{ id: string }>`
      update research_requests
      set held_at = now(), due_at = now() + interval '15 minutes'
      where id = ${data}
        and status = ${"claimed"}
        and researcher_id = ${context.userId}
        and held_at is null
        and due_at is not null
        and due_at <= now()
      returning id
    `;
    if (!won[0]) throw new Error("A hold is only after the first 15 minutes, and only once.");
    return { ok: true as const };
  });

export const askResearch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({
      id: z.string(),
      kind: z.enum(["question", "more_photos"]),
      body: z.string().max(300).optional(),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const body = data.body?.trim() || (data.kind === "more_photos" ? "Please send a few more photos." : "");
    if (body.length < 3) throw new Error("Ask the question in a sentence.");
    if (/@/.test(body) || /\d{7,}/.test(body)) throw new Error("No phone numbers, email, or addresses.");
    const sql = await getSql();
    const won = await sql<{ seller_id: string }>`
      update research_requests
      set paused_at = now()
      where id = ${data.id}
        and status = ${"claimed"}
        and researcher_id = ${context.userId}
        and paused_at is null
      returning seller_id
    `;
    if (!won[0]) throw new Error("You can ask once the seller has answered the last one.");
    await sql`
      insert into research_messages (id, request_id, author_id, body, photos, kind)
      values (${crypto.randomUUID()}, ${data.id}, ${context.userId}, ${body}, ${"[]"}, ${data.kind})
    `;
    await writeNotice(sql, {
      userId: won[0].seller_id,
      kind: "research",
      title: data.kind === "more_photos" ? "More photos, please" : "A researcher has a question",
      body: "The clock is paused until you answer. No names on this note.",
      refId: data.id,
    });
    return { ok: true as const };
  });

export const replyResearch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({
      id: z.string(),
      body: z.string().max(300).optional(),
      photos: z.array(z.string().min(20).max(1_500_000)).max(3).optional(),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const body = data.body?.trim() || null;
    const incoming = data.photos ?? [];
    if (!body && incoming.length === 0) throw new Error("Send a note or a photo.");
    if (body && (/@/.test(body) || /\d{7,}/.test(body))) throw new Error("No phone numbers, email, or addresses.");
    const sql = await getSql();
    const open = await sql<{ researcher_id: string; photos: string }>`
      select researcher_id, photos from research_requests
      where id = ${data.id} and seller_id = ${context.userId} and status = ${"claimed"} and paused_at is not null
    `;
    const row = open[0];
    if (!row?.researcher_id) throw new Error("Nothing is waiting on you.");
    const stored: string[] = [];
    for (const photo of incoming) {
      stored.push(await storePhoto(safePhoto(photo), `research/${data.id}-${crypto.randomUUID()}`));
    }
    const existing = JSON.parse(row.photos) as string[];
    const photos = [...existing, ...stored].slice(0, 8);
    await sql`
      insert into research_messages (id, request_id, author_id, body, photos, kind)
      values (${crypto.randomUUID()}, ${data.id}, ${context.userId}, ${body}, ${JSON.stringify(stored)}, ${"reply"})
    `;
    await sql`
      update research_requests
      set photos = ${JSON.stringify(photos)},
          paused_at = null,
          due_at = due_at + (now() - paused_at)
      where id = ${data.id} and seller_id = ${context.userId} and paused_at is not null
    `;
    await writeNotice(sql, {
      userId: row.researcher_id,
      kind: "research",
      title: stored.length ? "The seller added photos" : "The seller answered",
      body: "The clock is running again. You still have this one item.",
      refId: data.id,
    });
    return { ok: true as const };
  });

export const answerResearch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({
      id: z.string(),
      title: z.string().min(3).max(80),
      description: z.string().min(12).max(600),
      category: z.enum(categoryIds),
      condition: z.enum(["Like new", "Good", "Loved"]),
      lowCents: z.number().int().min(0).max(10_000_000),
      highCents: z.number().int().min(0).max(10_000_000),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    if (data.highCents < data.lowCents) throw new Error("The high end of the range has to be at least the low end.");
    const title = data.title.trim();
    const description = data.description.trim();
    if (/@/.test(description) || /\d{7,}/.test(description)) throw new Error("No phone numbers, email, or addresses.");
    const sql = await getSql();
    const won = await sql<{ seller_id: string }>`
      update research_requests set
        status = ${"review"},
        title = ${title},
        description = ${description},
        category = ${data.category},
        condition = ${data.condition},
        low_cents = ${data.lowCents},
        high_cents = ${data.highCents},
        answered_at = now(),
        paused_at = null
      where id = ${data.id} and status = ${"claimed"} and researcher_id = ${context.userId}
      returning seller_id
    `;
    if (!won[0]) throw new Error("Claim it before you send a write-up.");
    await writeNotice(sql, {
      userId: won[0].seller_id,
      kind: "research",
      title: "A researcher answered",
      body: "They suggested what it is and a price range. Accept it or pass. You still set the asking price.",
      refId: data.id,
    });
    return { ok: true as const };
  });

export const decideResearch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.string(), accept: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (!data.accept) {
      const current = await sql<{ researcher_id: string }>`
        select researcher_id from research_requests
        where id = ${data.id} and seller_id = ${context.userId} and status = ${"review"}
      `;
      const researcherId = current[0]?.researcher_id;
      if (!researcherId) throw new Error("Nothing is waiting on you.");
      const won = await sql<{ id: string }>`
        update research_requests set
          status = ${"open"},
          researcher_id = null,
          title = null,
          description = null,
          category = null,
          condition = null,
          low_cents = null,
          high_cents = null,
          claimed_at = null,
          answered_at = null,
          due_at = null,
          held_at = null,
          paused_at = null
        where id = ${data.id} and seller_id = ${context.userId} and status = ${"review"}
        returning id
      `;
      if (!won[0]) throw new Error("Nothing is waiting on you.");
      await sql`
        insert into research_passes (request_id, researcher_id)
        values (${data.id}, ${researcherId})
        on conflict do nothing
      `;
      await grantRep(sql, researcherId, "research_declined", -1, data.id);
      await writeNotice(sql, {
        userId: researcherId,
        kind: "research",
        title: "The seller passed",
        body: "Your write-up stays off their listing. −1 Rep. You are not paid for a pass.",
        refId: data.id,
      });
      return { ok: true as const };
    }
    const won = await sql<{ researcher_id: string; payout_cents: number }>`
      update research_requests
      set status = ${"accepted"}, decided_at = now()
      where id = ${data.id} and seller_id = ${context.userId} and status = ${"review"}
      returning researcher_id, payout_cents
    `;
    const row = won[0];
    if (!row?.researcher_id) throw new Error("Nothing is waiting on you.");
    const payout = Number(row.payout_cents);
    await give(sql, row.researcher_id, payout, "research_pay", data.id, "Researcher payout");
    if (payout > 0) {
      await writeLedger(sql, { userId: row.researcher_id, account: "research_payout", amountCents: payout, note: "Researcher payout" });
    }
    await grantRep(sql, row.researcher_id, "research_accepted", 1, data.id);
    await writeNotice(sql, {
      userId: row.researcher_id,
      kind: "research",
      title: "The seller accepted your write-up",
      body: payout > 0 ? "The payout is in your wallet. Test credits during beta." : "They kept it. This request had no payout.",
      refId: data.id,
    });
    return { ok: true as const };
  });

export const rateResearch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({
      id: z.string(),
      description: z.enum(["up", "down"]),
      accuracy: z.enum(["up", "down"]),
      price: z.enum(["up", "down"]),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const won = await sql<{ researcher_id: string }>`
      update research_requests set
        description_mark = ${data.description},
        accuracy_mark = ${data.accuracy},
        price_mark = ${data.price}
      where id = ${data.id}
        and seller_id = ${context.userId}
        and status = ${"accepted"}
        and description_mark is null
      returning researcher_id
    `;
    const researcherId = won[0]?.researcher_id;
    if (!researcherId) throw new Error("You already rated this, or it isn’t yours.");
    const good = data.description === "up" && data.accuracy === "up" && data.price === "up";
    await grantRep(sql, researcherId, good ? "research_up" : "research_down", good ? 2 : -2, data.id);
    return { ok: true as const };
  });

export const cancelResearch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const won = await sql<{ charged_cents: number }>`
      update research_requests
      set status = ${"cancelled"}, decided_at = now()
      where id = ${data} and seller_id = ${context.userId} and status = ${"open"}
      returning charged_cents
    `;
    const charged = Number(won[0]?.charged_cents ?? 0);
    if (!won[0]) throw new Error("You can only cancel one that nobody has claimed.");
    await give(sql, context.userId, charged, "research_refund", data, "Research refund");
    if (charged > 0) {
      await writeLedger(sql, { userId: context.userId, account: "research_refund", amountCents: -charged, note: "Research refund" });
    }
    return { ok: true as const };
  });

/** Pays range and asking bonuses once, when the seller payout for that listing releases. */
export async function payResearchBonuses(sql: Sql, orderId: string) {
  const rows = await sql<{
    amount_cents: number;
    price_cents: number;
    id: string;
    researcher_id: string;
    low_cents: number | null;
    high_cents: number | null;
  }>`
    select o.amount_cents, l.price_cents, r.id, r.researcher_id, r.low_cents, r.high_cents
    from orders o
    join listings l on l.id = o.listing_id
    join research_requests r on r.listing_id = l.id
    where o.id = ${orderId}
      and r.status = ${"accepted"}
      and r.bonus_paid_at is null
      and r.researcher_id is not null
    limit 1
  `;
  const row = rows[0];
  if (!row?.researcher_id) return;
  const sale = Number(row.amount_cents);
  const asking = Number(row.price_cents);
  const low = Number(row.low_cents ?? 0);
  const high = Number(row.high_cents ?? 0);
  const lo = Math.min(low, high);
  const hi = Math.max(low, high);
  const mid = lo + Math.floor((hi - lo) / 2);
  const rangeHit = hi > 0 && sale >= mid;
  const askHit = asking > 0 && sale >= asking;
  const rangeBonus = rangeHit ? await feeCents(sql, "research_range_bonus") : 0;
  const askingBonus = askHit ? await feeCents(sql, "research_asking_bonus") : 0;
  const claimed = await sql<{ id: string }>`
    update research_requests
    set bonus_paid_at = now(), range_bonus_cents = ${rangeBonus}, asking_bonus_cents = ${askingBonus}
    where id = ${row.id} and bonus_paid_at is null
    returning id
  `;
  if (!claimed[0]) return;
  const total = rangeBonus + askingBonus;
  if (total <= 0) return;
  const parts = [
    rangeBonus > 0 ? "top half of the range" : null,
    askingBonus > 0 ? "full asking price" : null,
  ].filter(Boolean);
  await give(sql, row.researcher_id, total, "research_bonus", orderId, `Research bonus: ${parts.join(" and ")}`);
  await writeLedger(sql, {
    userId: row.researcher_id,
    orderId,
    account: "research_bonus",
    amountCents: total,
    note: `Research bonus: ${parts.join(" and ")}`,
  });
  await writeNotice(sql, {
    userId: row.researcher_id,
    kind: "research",
    title: "Research bonus",
    body: `The item sold. ${parts.join(" and ")}. $${(total / 100).toFixed(2)} is in your wallet. Test credits during beta.`,
    refId: orderId,
  });
}

export const researchFeeLabel = feeById(DEFAULT_FEES, "research_ask");

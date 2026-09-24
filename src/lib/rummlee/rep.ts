import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { HOUSE_FARGO } from "./constants";

type Sql = Awaited<ReturnType<typeof getSql>>;

async function currentUserId() {
  try {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const user = await getSessionUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export const REP_START = 100;
const REP_MIN = 0;
const REP_MAX = 300;
const HELPFUL_NEED = 2;

export const NOTE_KINDS = [
  { id: "not_item", label: "Not the item in the photo" },
  { id: "missing_flaw", label: "A flaw is missing" },
  { id: "wrong_details", label: "Wrong size, condition, or details" },
  { id: "not_real", label: "Doesn’t look like a real item" },
] as const;

export type NoteKind = (typeof NOTE_KINDS)[number]["id"];

export async function grantRep(sql: Sql, profileId: string, kind: string, points: number, refId: string) {
  if (!profileId || profileId.startsWith("seed-") || profileId === HOUSE_FARGO.profileId) return false;
  const inserted = await sql<{ id: string }>`
    insert into rep_events (id, profile_id, kind, points, ref_id)
    values (${crypto.randomUUID()}, ${profileId}, ${kind}, ${points}, ${refId})
    on conflict (profile_id, kind, ref_id) do nothing
    returning id
  `;
  if (!inserted[0]) return false;
  await sql`
    update profiles
    set rep = least(${REP_MAX}, greatest(${REP_MIN}, coalesce(rep, ${REP_START}) + ${points}))
    where id = ${profileId}
  `;
  return true;
}

export async function awardCleanRun(sql: Sql, sellerId: string) {
  const rows = await sql<{ dropoffs: number; refused: number }>`
    select
      count(*) filter (where checked_in_at is not null)::int as dropoffs,
      count(*) filter (where dispute_note = ${"Counter refused the package"})::int as refused
    from orders
    where seller_id = ${sellerId}
  `;
  const dropoffs = Number(rows[0]?.dropoffs ?? 0);
  const refused = Number(rows[0]?.refused ?? 0);
  if (dropoffs >= 5 && refused === 0) await grantRep(sql, sellerId, "clean_handoffs", 5, "5");
}

async function settleNote(sql: Sql, noteId: string) {
  const shown = await sql<{ id: string; author_id: string; seller_id: string }>`
    update listing_notes
    set status = ${"shown"}
    where id = ${noteId}
      and status = ${"proposed"}
      and helpful >= ${HELPFUL_NEED}
      and helpful > not_helpful
    returning id, author_id, seller_id
  `;
  if (shown[0]) {
    await grantRep(sql, shown[0].author_id, "note_caught", 3, shown[0].id);
    await grantRep(sql, shown[0].seller_id, "note_upheld", -5, shown[0].id);
    return;
  }
  const rejected = await sql<{ id: string; author_id: string }>`
    update listing_notes
    set status = ${"rejected"}
    where id = ${noteId}
      and status = ${"proposed"}
      and not_helpful >= ${HELPFUL_NEED}
      and not_helpful > helpful
    returning id, author_id
  `;
  if (rejected[0]) await grantRep(sql, rejected[0].author_id, "note_fake", -4, rejected[0].id);
}

function kindLabel(kind: string) {
  return NOTE_KINDS.find((row) => row.id === kind)?.label ?? "Description miss";
}

export type PublicNote = {
  id: string;
  kind: string;
  kindLabel: string;
  body: string;
  status: "proposed" | "shown" | "rejected";
  helpful: number;
  notHelpful: number;
  sellerReply: string | null;
  mine: boolean;
  myVote: "helpful" | "not_helpful" | null;
};

export const getListingNotes = createServerFn({ method: "GET" })
  .validator((listingId: string) => listingId)
  .handler(async ({ data: listingId }) => {
    const sql = await getSql();
    const userId = await currentUserId();
    const rows = await sql<{
      id: string;
      author_id: string;
      kind: string;
      body: string;
      status: string;
      helpful: number;
      not_helpful: number;
      seller_reply: string | null;
    }>`
      select id, author_id, kind, body, status, helpful, not_helpful, seller_reply
      from listing_notes
      where listing_id = ${listingId}
      order by created_at desc
      limit 20
    `;
    const votes = userId
      ? await sql<{ note_id: string; vote: string }>`
          select note_id, vote from note_votes where voter_id = ${userId}
        `
      : [];
    const voteByNote = new Map(votes.map((row) => [row.note_id, row.vote]));
    const notes: PublicNote[] = rows
      .filter((row) => row.status === "shown" || (userId && row.status === "proposed"))
      .map((row) => ({
        id: row.id,
        kind: row.kind,
        kindLabel: kindLabel(row.kind),
        body: row.body,
        status: row.status === "shown" || row.status === "rejected" ? row.status : "proposed",
        helpful: Number(row.helpful),
        notHelpful: Number(row.not_helpful),
        sellerReply: row.seller_reply,
        mine: row.author_id === userId,
        myVote: voteByNote.get(row.id) === "helpful" || voteByNote.get(row.id) === "not_helpful" ? voteByNote.get(row.id) as "helpful" | "not_helpful" : null,
      }));
    return { notes, signedIn: Boolean(userId) };
  });

export const fileNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        listingId: z.string(),
        kind: z.enum(["not_item", "missing_flaw", "wrong_details", "not_real"]),
        body: z.string().min(12).max(240),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const body = data.body.trim();
    if (body.length < 12) throw new Error("Say what’s wrong in a sentence.");
    if (/@/.test(body) || /\d{7,}/.test(body)) {
      throw new Error("No names, phone numbers, email, or addresses in a note.");
    }
    const sql = await getSql();
    const listing = await sql<{ id: string; seller_id: string; status: string }>`
      select id, seller_id, status from listings where id = ${data.listingId}
    `;
    const item = listing[0];
    if (!item || (item.status !== "live" && item.status !== "held")) throw new Error("That listing isn’t open for notes.");
    if (item.seller_id === context.userId) throw new Error("You can’t note your own listing.");
    if (item.seller_id === HOUSE_FARGO.profileId) throw new Error("Shelf items are already Rummlee’s. Rate the handoff instead.");
    const open = await sql<{ n: number }>`
      select count(*)::int as n from listing_notes
      where author_id = ${context.userId} and status = ${"proposed"}
    `;
    if (Number(open[0]?.n ?? 0) >= 3) throw new Error("You already have 3 notes waiting. Let neighbors vote on those first.");
    const dup = await sql<{ id: string }>`
      select id from listing_notes where listing_id = ${item.id} and author_id = ${context.userId}
    `;
    if (dup[0]) throw new Error("You already noted this listing.");
    await sql`
      insert into listing_notes (id, listing_id, author_id, seller_id, kind, body, status)
      values (${crypto.randomUUID()}, ${item.id}, ${context.userId}, ${item.seller_id}, ${data.kind}, ${body}, ${"proposed"})
    `;
    return { ok: true as const };
  });

export const voteNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ noteId: z.string(), vote: z.enum(["helpful", "not_helpful"]) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const notes = await sql<{ id: string; author_id: string; seller_id: string; status: string }>`
      select id, author_id, seller_id, status from listing_notes where id = ${data.noteId}
    `;
    const note = notes[0];
    if (!note) throw new Error("Note not found.");
    if (note.status !== "proposed") throw new Error("Neighbors already settled this note.");
    if (note.author_id === context.userId) throw new Error("You can’t vote on your own note.");
    if (note.seller_id === context.userId) throw new Error("You can’t vote on a note about your listing.");
    const existing = await sql<{ vote: string }>`
      select vote from note_votes where note_id = ${note.id} and voter_id = ${context.userId}
    `;
    if (existing[0]) throw new Error("You already voted.");
    await sql`
      insert into note_votes (note_id, voter_id, vote)
      values (${note.id}, ${context.userId}, ${data.vote})
    `;
    await sql`
      update listing_notes set
        helpful = (select count(*)::int from note_votes where note_id = ${note.id} and vote = ${"helpful"}),
        not_helpful = (select count(*)::int from note_votes where note_id = ${note.id} and vote = ${"not_helpful"})
      where id = ${note.id}
    `;
    await settleNote(sql, note.id);
    return { ok: true as const };
  });

export const replyNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ noteId: z.string(), reply: z.string().min(4).max(240) }).parse(data))
  .handler(async ({ context, data }) => {
    const reply = data.reply.trim();
    if (/@/.test(reply) || /\d{7,}/.test(reply)) throw new Error("No names, phone numbers, email, or addresses.");
    const sql = await getSql();
    const won = await sql<{ id: string }>`
      update listing_notes
      set seller_reply = ${reply}
      where id = ${data.noteId} and seller_id = ${context.userId} and seller_reply is null and status <> ${"rejected"}
      returning id
    `;
    if (!won[0]) throw new Error("You can’t reply to that note.");
    return { ok: true as const };
  });

export type BoardRow = {
  handle: string;
  neighborhood: string | null;
  rep: number;
  catches: number;
  facts: number;
  agreedUp: number;
  agreedDown: number;
  dropoffs: number;
  refused: number;
};

export type WeekRow = { handle: string; points: number };

const ONCE_FIELDS = new Set(["brand", "size", "material", "era"]);

export const FACT_FIELDS = [
  { id: "brand", label: "Brand" },
  { id: "size", label: "Size" },
  { id: "material", label: "Material" },
  { id: "era", label: "Era" },
  { id: "flaw", label: "A flaw" },
  { id: "included", label: "What’s included" },
] as const;

export type FactField = (typeof FACT_FIELDS)[number]["id"];

function cleanFact(value: string) {
  const text = value.trim();
  if (text.length < 2 || text.length > 80) throw new Error("Keep the addition short.");
  if (/@/.test(text) || /\d{7,}/.test(text)) throw new Error("No phone numbers, email, or addresses.");
  return text;
}

async function ping(sql: Sql, userId: string, title: string, body: string, refId: string) {
  await sql`
    insert into notices (id, user_id, kind, title, body, ref_id)
    values (${crypto.randomUUID()}, ${userId}, ${"rep"}, ${title}, ${body}, ${refId})
  `;
}

export type PublicFact = {
  id: string;
  field: string;
  label: string;
  value: string;
  status: "proposed" | "approved" | "declined";
  handle: string | null;
  mine: boolean;
  canDecide: boolean;
};

export const getListingFacts = createServerFn({ method: "GET" })
  .validator((listingId: string) => listingId)
  .handler(async ({ data: listingId }) => {
    const sql = await getSql();
    const userId = await currentUserId();
    const rows = await sql<{
      id: string;
      author_id: string;
      seller_id: string;
      field: string;
      value: string;
      status: string;
      handle: string;
    }>`
      select f.id, f.author_id, f.seller_id, f.field, f.value, f.status, p.handle
      from listing_facts f
      join profiles p on p.id = f.author_id
      where f.listing_id = ${listingId}
      order by f.created_at
    `;
    const facts: PublicFact[] = rows
      .filter((row) => {
        if (row.status === "approved") return true;
        if (!userId) return false;
        if (row.status === "proposed") return row.author_id === userId || row.seller_id === userId;
        return row.status === "declined" && row.author_id === userId;
      })
      .map((row) => ({
        id: row.id,
        field: row.field,
        label: FACT_FIELDS.find((item) => item.id === row.field)?.label ?? row.field,
        value: row.value,
        status: row.status === "approved" || row.status === "declined" ? row.status : "proposed",
        handle: row.status === "approved" ? row.handle : null,
        mine: row.author_id === userId,
        canDecide: row.status === "proposed" && row.seller_id === userId,
      }));
    return { facts };
  });

export const fileFact = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({
      listingId: z.string(),
      field: z.enum(["brand", "size", "material", "era", "flaw", "included"]),
      value: z.string().min(2).max(80),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const value = cleanFact(data.value);
    const sql = await getSql();
    const listing = await sql<{ id: string; seller_id: string; status: string }>`
      select id, seller_id, status from listings where id = ${data.listingId}
    `;
    const item = listing[0];
    if (!item || (item.status !== "live" && item.status !== "held")) throw new Error("That listing isn’t open for additions.");
    if (item.seller_id === context.userId) throw new Error("Add this on your own listing instead of a neighbor note.");
    if (item.seller_id === HOUSE_FARGO.profileId || item.seller_id.startsWith("seed-")) {
      throw new Error("Sample listings don’t take neighbor additions.");
    }
    const open = await sql<{ n: number }>`
      select count(*)::int as n from listing_facts where author_id = ${context.userId} and status = ${"proposed"}
    `;
    if (Number(open[0]?.n ?? 0) >= 3) throw new Error("You already have 3 additions waiting on a seller.");
    if (ONCE_FIELDS.has(data.field)) {
      const filled = await sql<{ id: string }>`
        select id from listing_facts
        where listing_id = ${item.id} and field = ${data.field} and status in (${"proposed"}, ${"approved"})
      `;
      if (filled[0]) throw new Error("That blank is already filled or waiting on the seller.");
    } else {
      const stack = await sql<{ n: number }>`
        select count(*)::int as n from listing_facts
        where listing_id = ${item.id} and field = ${data.field} and status in (${"proposed"}, ${"approved"})
      `;
      if (Number(stack[0]?.n ?? 0) >= 3) throw new Error("That listing already has three of those.");
    }
    const id = crypto.randomUUID();
    await sql`
      insert into listing_facts (id, listing_id, author_id, seller_id, field, value, status)
      values (${id}, ${item.id}, ${context.userId}, ${item.seller_id}, ${data.field}, ${value}, ${"proposed"})
    `;
    await ping(sql, item.seller_id, "A neighbor filled a blank", "They added a detail. Approve it and it shows. Decline it and it stays off the listing.", id);
    return { ok: true as const };
  });

export const decideFact = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ factId: z.string(), approve: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const status = data.approve ? "approved" : "declined";
    const won = await sql<{ id: string; author_id: string }>`
      update listing_facts
      set status = ${status}, decided_at = now()
      where id = ${data.factId} and seller_id = ${context.userId} and status = ${"proposed"}
      returning id, author_id
    `;
    const fact = won[0];
    if (!fact) throw new Error("That addition isn’t waiting on you.");
    if (data.approve) {
      await grantRep(sql, fact.author_id, "fact_approved", 2, fact.id);
      await ping(sql, fact.author_id, "The seller approved your addition", "It now shows on the listing. +2 Rep.", fact.id);
    } else {
      await grantRep(sql, fact.author_id, "fact_declined", -2, fact.id);
      await ping(sql, fact.author_id, "The seller declined your addition", "It stays off the listing. −2 Rep.", fact.id);
    }
    return { ok: true as const };
  });

export const getScoreboard = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql<{
    handle: string;
    neighborhood: string | null;
    rep: number;
    catches: number;
    facts: number;
    agreed_up: number;
    agreed_down: number;
    dropoffs: number;
    refused: number;
  }>`
    select p.handle, p.neighborhood, p.rep,
      (select count(*)::int from listing_notes n where n.author_id = p.id and n.status = ${"shown"}) as catches,
      (select count(*)::int from listing_facts f where f.author_id = p.id and f.status = ${"approved"}) as facts,
      (select count(*)::int from ratings r where r.subject_id = p.id and r.role = ${"buyer"} and r.as_agreed = ${"up"}) as agreed_up,
      (select count(*)::int from ratings r where r.subject_id = p.id and r.role = ${"buyer"} and r.as_agreed = ${"down"}) as agreed_down,
      (select count(*)::int from orders o where o.seller_id = p.id and o.checked_in_at is not null) as dropoffs,
      (select count(*)::int from orders o where o.seller_id = p.id and o.dispute_note = ${"Counter refused the package"}) as refused
    from profiles p
    where p.deleted_at is null
      and coalesce(p.is_house, false) = false
      and p.id not like ${"seed-%"}
      and p.id <> ${HOUSE_FARGO.profileId}
    order by p.rep desc, catches desc, p.handle
    limit 25
  `;
  const week = await sql<{ handle: string; points: number }>`
    select p.handle, coalesce(sum(e.points), 0)::int as points
    from rep_events e
    join profiles p on p.id = e.profile_id
    where e.created_at > now() - interval '7 days'
      and p.deleted_at is null
      and coalesce(p.is_house, false) = false
      and p.id not like ${"seed-%"}
      and p.id <> ${HOUSE_FARGO.profileId}
    group by p.handle
    order by points desc, p.handle
    limit 10
  `;
  return {
    board: rows.map(
      (row): BoardRow => ({
        handle: row.handle,
        neighborhood: row.neighborhood,
        rep: Number(row.rep ?? REP_START),
        catches: Number(row.catches),
        facts: Number(row.facts),
        agreedUp: Number(row.agreed_up),
        agreedDown: Number(row.agreed_down),
        dropoffs: Number(row.dropoffs),
        refused: Number(row.refused),
      }),
    ),
    week: week.map((row): WeekRow => ({ handle: row.handle, points: Number(row.points) })),
  };
});

export const getMyRep = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      rep: number;
      catches: number;
      facts: number;
      agreed_up: number;
      agreed_down: number;
      dropoffs: number;
      refused: number;
    }>`
      select p.rep,
        (select count(*)::int from listing_notes n where n.author_id = p.id and n.status = ${"shown"}) as catches,
        (select count(*)::int from listing_facts f where f.author_id = p.id and f.status = ${"approved"}) as facts,
        (select count(*)::int from ratings r where r.subject_id = p.id and r.role = ${"buyer"} and r.as_agreed = ${"up"}) as agreed_up,
        (select count(*)::int from ratings r where r.subject_id = p.id and r.role = ${"buyer"} and r.as_agreed = ${"down"}) as agreed_down,
        (select count(*)::int from orders o where o.seller_id = p.id and o.checked_in_at is not null) as dropoffs,
        (select count(*)::int from orders o where o.seller_id = p.id and o.dispute_note = ${"Counter refused the package"}) as refused
      from profiles p
      where p.id = ${context.userId}
    `;
    const row = rows[0];
    return {
      rep: Number(row?.rep ?? REP_START),
      catches: Number(row?.catches ?? 0),
      facts: Number(row?.facts ?? 0),
      agreedUp: Number(row?.agreed_up ?? 0),
      agreedDown: Number(row?.agreed_down ?? 0),
      dropoffs: Number(row?.dropoffs ?? 0),
      refused: Number(row?.refused ?? 0),
    };
  });

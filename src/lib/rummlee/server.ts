import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureFees, ensureSeed } from "./seed";
import { feeOn, isSeedUser, makeHandle, parseSpotKind, payBaseCents, pickupCode, splitModes, canonicalizeMode } from "./format";
import { checkoutQuote, mapFeeRow, minAskingCents, type FeeRow } from "./fees";
import { MIN_PRICE_CENTS, TEST_MODE, TEST_STARTER_CENTS, resolveListingId } from "./constants";
import type {
  HandoffMode,
  HandoffSpot,
  InboxPayload,
  Listing,
  Message,
  Offer,
  Order,
  Profile,
  Sale,
  WalletTx,
} from "./types";

type ListingRow = {
  id: string;
  sale_id: string;
  sale_name: string;
  seller_id: string;
  seller_handle: string;
  title: string;
  description: string;
  price_cents: number;
  buy_now_cents: number | null;
  original_cents: number | null;
  category: string;
  condition: string;
  haul: string;
  neighborhood: string;
  handoff_modes: string;
  handoff_spot_name: string | null;
  handoff_spot_area: string | null;
  handoff_spot_hint: string | null;
  handoff_spot_kind: string | null;
  photo_url: string;
  status: Listing["status"];
  starts_on: string;
  ends_on: string;
  floor_cents: number | null;
};

function mapListing(row: ListingRow, saved = false): Listing {
  return {
    id: row.id,
    saleId: row.sale_id,
    saleName: row.sale_name,
    sellerId: row.seller_id,
    sellerHandle: row.seller_handle,
    title: row.title,
    description: row.description,
    priceCents: Number(row.price_cents),
    // Buy-now uses the asking price. A higher stored buy_now_cents is not a second fee base.
    buyNowCents: Number(row.price_cents),
    originalCents: row.original_cents == null ? null : Number(row.original_cents),
    category: row.category,
    condition: row.condition,
    haul: row.haul,
    neighborhood: row.neighborhood,
    handoffModes: splitModes(row.handoff_modes),
    handoffSpotName: row.handoff_spot_name,
    handoffSpotArea: row.handoff_spot_area,
    handoffSpotHint: row.handoff_spot_hint,
    handoffSpotKind: parseSpotKind(row.handoff_spot_kind),
    photoUrl: row.photo_url,
    status: row.status,
    saleStartsOn: row.starts_on,
    saleEndsOn: row.ends_on,
    saved,
  };
}

async function optionalUserId() {
  try {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const u = await getSessionUser();
    return u?.id ?? null;
  } catch {
    return null;
  }
}

async function loadFees(sql: Awaited<ReturnType<typeof getSql>>): Promise<FeeRow[]> {
  await ensureFees(sql);
  const rows = await sql<{
    id: string;
    label: string;
    description: string;
    unit: string;
    percent_bps: number;
    amount_cents: number;
    charged_to: string;
    charged_when: string;
    sort: number;
    enabled: boolean;
  }>`select id, label, description, unit, percent_bps, amount_cents, charged_to, charged_when, sort, enabled from rummlee_fees order by sort`;
  return rows.map(mapFeeRow);
}

async function viewerPremium(sql: Awaited<ReturnType<typeof getSql>>, userId: string | null) {
  if (!userId) return false;
  const rows = await sql<{ is_premium: boolean }>`select is_premium from profiles where id = ${userId}`;
  return Boolean(rows[0]?.is_premium);
}

async function grantTestCredits(
  sql: Awaited<ReturnType<typeof getSql>>,
  userId: string,
  currentCents: number,
): Promise<number> {
  if (!TEST_MODE) return currentCents;
  const txs = await sql<{ id: string }>`select id from wallet_tx where user_id = ${userId} limit 1`;
  if (txs[0] || currentCents > 0) return currentCents;
  await sql`update profiles set wallet_cents = ${TEST_STARTER_CENTS} where id = ${userId}`;
  await sql`
    insert into wallet_tx (id, user_id, kind, amount_cents, note)
    values (${crypto.randomUUID()}, ${userId}, ${"beta"}, ${TEST_STARTER_CENTS}, ${"Beta test credits — not real money"})
  `;
  return TEST_STARTER_CENTS;
}

async function ensureProfile(sql: Awaited<ReturnType<typeof getSql>>, userId: string): Promise<Profile> {
  const existing = await sql<{
    id: string;
    handle: string;
    neighborhood: string | null;
    zip: string | null;
    is_premium: boolean;
    is_staff: boolean;
    wallet_cents: number;
  }>`select id, handle, neighborhood, zip, is_premium, is_staff, wallet_cents from profiles where id = ${userId}`;
  if (existing[0]) {
    const p = existing[0];
    const walletCents = await grantTestCredits(sql, userId, Number(p.wallet_cents));
    return {
      id: p.id,
      handle: p.handle,
      neighborhood: p.neighborhood,
      zip: p.zip,
      isPremium: Boolean(p.is_premium),
      isStaff: Boolean(p.is_staff),
      walletCents,
    };
  }
  let handle = makeHandle();
  for (let i = 0; i < 8; i += 1) {
    const clash = await sql<{ id: string }>`select id from profiles where handle = ${handle}`;
    if (!clash[0]) break;
    handle = makeHandle();
  }
  const start = TEST_MODE ? TEST_STARTER_CENTS : 0;
  await sql`
    insert into profiles (id, handle, neighborhood, zip, wallet_cents)
    values (${userId}, ${handle}, ${null}, ${null}, ${start})
  `;
  if (TEST_MODE && start > 0) {
    await sql`
      insert into wallet_tx (id, user_id, kind, amount_cents, note)
      values (${crypto.randomUUID()}, ${userId}, ${"beta"}, ${start}, ${"Beta test credits — not real money"})
    `;
  }
  return {
    id: userId,
    handle,
    neighborhood: null,
    zip: null,
    isPremium: false,
    isStaff: false,
    walletCents: start,
  };
}

const listingSelect = `
  select l.id, l.sale_id, s.name as sale_name, l.seller_id, p.handle as seller_handle,
         l.title, l.description, l.price_cents, l.buy_now_cents, l.original_cents, l.floor_cents,
         l.category, l.condition, l.haul, l.neighborhood, l.handoff_modes, l.photo_url,
         l.status, s.starts_on, s.ends_on,
         hs.name as handoff_spot_name, hs.area as handoff_spot_area, hs.hint as handoff_spot_hint,
         hs.kind as handoff_spot_kind
  from listings l
  join sales s on s.id = l.sale_id
  join profiles p on p.id = l.seller_id
  left join handoff_spots hs on hs.id = s.handoff_spot_id
`;

export const bootstrapPublic = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  await ensureSeed(sql);
  const userId = await optionalUserId();
  const buyerPremium = await viewerPremium(sql, userId);
  const rows = await sql.query<ListingRow>(
    listingSelect + " where l.status = 'live' order by l.created_at desc",
  );
  let saved = new Set<string>();
  if (userId) {
    const savedRows = await sql<{ listing_id: string }>`select listing_id from saved_listings where user_id = ${userId}`;
    saved = new Set(savedRows.map((r) => r.listing_id));
  }
  const salesRows = await sql.query<{
    id: string;
    seller_id: string;
    seller_handle: string;
    name: string;
    kind: string;
    neighborhood: string;
    starts_on: string;
    ends_on: string;
    handoff_modes: string;
    handoff_spot_id: string | null;
    status: Sale["status"];
    item_count: number;
  }>(
    `select s.id, s.seller_id, p.handle as seller_handle, s.name, s.kind, s.neighborhood,
            s.starts_on, s.ends_on, s.handoff_modes, s.handoff_spot_id, s.status,
            (select count(*)::int from listings l where l.sale_id = s.id and l.status = 'live') as item_count
     from sales s join profiles p on p.id = s.seller_id
     where s.status = 'live' order by s.starts_on, s.name`,
  );
  const spots = await sql<HandoffSpot>`
    select id, name, area, hint, kind from handoff_spots
    order by case when kind = 'partner' then 0 else 1 end, name
  `;
  return {
    listings: rows.map((r) => mapListing(r, saved.has(r.id))),
    sales: salesRows.map(
      (s): Sale => ({
        id: s.id,
        sellerId: s.seller_id,
        sellerHandle: s.seller_handle,
        name: s.name,
        kind: s.kind,
        neighborhood: s.neighborhood,
        startsOn: s.starts_on,
        endsOn: s.ends_on,
        handoffModes: splitModes(s.handoff_modes),
        handoffSpotId: s.handoff_spot_id,
        status: s.status,
        itemCount: Number(s.item_count),
      }),
    ),
    spots,
    signedIn: Boolean(userId),
    buyerPremium,
    fees: await loadFees(sql),
  };
});

export const getListing = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: rawId }) => {
    const id = resolveListingId(rawId);
    const sql = await getSql();
    await ensureSeed(sql);
    const rows = await sql.query<ListingRow>(listingSelect + " where l.id = $1", [id]);
    const row = rows[0];
    if (!row) return null;
    const userId = await optionalUserId();
    const buyerPremium = await viewerPremium(sql, userId);
    const publicRows = await sql<{ id: string; name: string; area: string; hint: string }>`
      select id, name, area, hint from handoff_spots
      where kind = ${"public"} and area = ${row.neighborhood}
      order by name
      limit 1
    `;
    const pub = publicRows[0];
    const publicSpot: HandoffSpot | null = pub
      ? { id: pub.id, name: pub.name, area: pub.area, hint: pub.hint, kind: "public" }
      : null;
    let saved = false;
    let myOffer: Offer | null = null;
    if (userId) {
      const s = await sql<{ listing_id: string }>`select listing_id from saved_listings where user_id = ${userId} and listing_id = ${id}`;
      saved = Boolean(s[0]);
      const o = await sql<{
        id: string;
        listing_id: string;
        listing_title: string;
        listing_photo: string;
        listing_price_cents: number;
        buyer_id: string;
        buyer_handle: string;
        seller_id: string;
        seller_handle: string;
        amount_cents: number;
        counter_cents: number | null;
        status: Offer["status"];
        declined_by: string | null;
        note: string | null;
        created_at: string;
      }>`
        select o.id, o.listing_id, l.title as listing_title, l.photo_url as listing_photo,
               l.price_cents as listing_price_cents,
               o.buyer_id, b.handle as buyer_handle, o.seller_id, se.handle as seller_handle,
               o.amount_cents, o.counter_cents, o.status, o.declined_by, o.note, o.created_at
        from offers o
        join listings l on l.id = o.listing_id
        join profiles b on b.id = o.buyer_id
        join profiles se on se.id = o.seller_id
        where o.listing_id = ${id} and o.buyer_id = ${userId}
        order by o.created_at desc limit 1
      `;
      if (o[0]) {
        const r = o[0];
        myOffer = {
          id: r.id,
          listingId: r.listing_id,
          listingTitle: r.listing_title,
          listingPhoto: r.listing_photo,
          listingPriceCents: Number(r.listing_price_cents),
          buyerId: r.buyer_id,
          buyerHandle: r.buyer_handle,
          sellerId: r.seller_id,
          sellerHandle: r.seller_handle,
          amountCents: Number(r.amount_cents),
          counterCents: r.counter_cents == null ? null : Number(r.counter_cents),
          status: r.status,
          declinedBy: r.declined_by === "buyer" || r.declined_by === "seller" || r.declined_by === "floor" ? r.declined_by : null,
          note: r.note,
          createdAt: r.created_at,
        };
      }
    }
    const thread = userId
      ? await sql<{
          id: string;
          listing_id: string;
          listing_title: string;
          from_id: string;
          from_handle: string;
          to_id: string;
          body: string;
          created_at: string;
        }>`
          select m.id, m.listing_id, l.title as listing_title, m.from_id, p.handle as from_handle,
                 m.to_id, m.body, m.created_at
          from messages m
          join listings l on l.id = m.listing_id
          join profiles p on p.id = m.from_id
          where m.listing_id = ${id} and (m.from_id = ${userId} or m.to_id = ${userId})
          order by m.created_at asc
        `
      : [];
    let myOrder: Order | null = null;
    if (userId) {
      const orows = await sql<{
        id: string;
        listing_id: string;
        listing_title: string;
        listing_photo: string;
        buyer_id: string;
        buyer_handle: string;
        seller_id: string;
        seller_handle: string;
        amount_cents: number;
        fee_cents: number;
        status: Order["status"];
        pickup_code: string;
        buyer_confirmed: boolean;
        seller_confirmed: boolean;
        handoff_type: Order["handoffType"];
        created_at: string;
      }>`
        select o.id, o.listing_id, l.title as listing_title, l.photo_url as listing_photo,
               o.buyer_id, b.handle as buyer_handle, o.seller_id, se.handle as seller_handle,
               o.amount_cents, o.fee_cents, o.status, o.pickup_code, o.buyer_confirmed, o.seller_confirmed,
               o.handoff_type, o.created_at
        from orders o
        join listings l on l.id = o.listing_id
        join profiles b on b.id = o.buyer_id
        join profiles se on se.id = o.seller_id
        where o.listing_id = ${id} and (o.buyer_id = ${userId} or o.seller_id = ${userId})
        order by o.created_at desc
        limit 1
      `;
      const o = orows[0];
      if (o) {
        myOrder = {
          id: o.id,
          listingId: o.listing_id,
          listingTitle: o.listing_title,
          listingPhoto: o.listing_photo,
          buyerId: o.buyer_id,
          buyerHandle: o.buyer_handle,
          sellerId: o.seller_id,
          sellerHandle: o.seller_handle,
          amountCents: Number(o.amount_cents),
          feeCents: Number(o.fee_cents),
          status: o.status,
          pickupCode: o.pickup_code,
          buyerConfirmed: Boolean(o.buyer_confirmed),
          sellerConfirmed: Boolean(o.seller_confirmed),
          handoffType: o.handoff_type,
          createdAt: o.created_at,
        };
      }
    }
    return {
      listing: mapListing(row, saved),
      myOffer,
      myOrder,
      buyerPremium,
      publicSpot,
      floorCents: userId === row.seller_id ? Number(row.floor_cents ?? row.price_cents) : null,
      fees: await loadFees(sql),
      messages: thread.map(
        (m): Message => ({
          id: m.id,
          listingId: m.listing_id,
          listingTitle: m.listing_title,
          fromId: m.from_id,
          fromHandle: m.from_handle,
          toId: m.to_id,
          body: m.body,
          createdAt: m.created_at,
        }),
      ),
    };
  });

export const getSale = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const sql = await getSql();
    await ensureSeed(sql);
    const sales = await sql.query<{
      id: string;
      seller_id: string;
      seller_handle: string;
      name: string;
      kind: string;
      neighborhood: string;
      starts_on: string;
      ends_on: string;
      handoff_modes: string;
      handoff_spot_id: string | null;
      status: Sale["status"];
      item_count: number;
    }>(
      `select s.id, s.seller_id, p.handle as seller_handle, s.name, s.kind, s.neighborhood,
              s.starts_on, s.ends_on, s.handoff_modes, s.handoff_spot_id, s.status,
              (select count(*)::int from listings l where l.sale_id = s.id) as item_count
       from sales s join profiles p on p.id = s.seller_id where s.id = $1`,
      [id],
    );
    const sale = sales[0];
    if (!sale) return null;
    const rows = await sql.query<ListingRow>(listingSelect + " where l.sale_id = $1 order by l.created_at desc", [id]);
    const userId = await optionalUserId();
    let saved = new Set<string>();
    if (userId) {
      const savedRows = await sql<{ listing_id: string }>`select listing_id from saved_listings where user_id = ${userId}`;
      saved = new Set(savedRows.map((r) => r.listing_id));
    }
    return {
      sale: {
        id: sale.id,
        sellerId: sale.seller_id,
        sellerHandle: sale.seller_handle,
        name: sale.name,
        kind: sale.kind,
        neighborhood: sale.neighborhood,
        startsOn: sale.starts_on,
        endsOn: sale.ends_on,
        handoffModes: splitModes(sale.handoff_modes),
        handoffSpotId: sale.handoff_spot_id,
        status: sale.status,
        itemCount: Number(sale.item_count),
      } satisfies Sale,
      listings: rows.map((r) => mapListing(r, saved.has(r.id))),
    };
  });

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureSeed(sql);
    const me = await ensureProfile(sql, context.userId);
    const txs = await sql<{
      id: string;
      kind: string;
      amount_cents: number;
      note: string | null;
      created_at: string;
    }>`select id, kind, amount_cents, note, created_at from wallet_tx where user_id = ${context.userId} order by created_at desc limit 20`;
    const mySales = await sql.query<{
      id: string;
      seller_id: string;
      seller_handle: string;
      name: string;
      kind: string;
      neighborhood: string;
      starts_on: string;
      ends_on: string;
      handoff_modes: string;
      handoff_spot_id: string | null;
      status: Sale["status"];
      item_count: number;
    }>(
      `select s.id, s.seller_id, p.handle as seller_handle, s.name, s.kind, s.neighborhood,
              s.starts_on, s.ends_on, s.handoff_modes, s.handoff_spot_id, s.status,
              (select count(*)::int from listings l where l.sale_id = s.id) as item_count
       from sales s join profiles p on p.id = s.seller_id
       where s.seller_id = $1 order by s.created_at desc`,
      [context.userId],
    );
    const savedRows = await sql.query<ListingRow>(
      listingSelect +
        " join saved_listings sv on sv.listing_id = l.id where sv.user_id = $1 order by sv.created_at desc",
      [context.userId],
    );
    return {
      me,
      txs: txs.map(
        (t): WalletTx => ({
          id: t.id,
          kind: t.kind,
          amountCents: Number(t.amount_cents),
          note: t.note,
          createdAt: t.created_at,
        }),
      ),
      sales: mySales.map(
        (s): Sale => ({
          id: s.id,
          sellerId: s.seller_id,
          sellerHandle: s.seller_handle,
          name: s.name,
          kind: s.kind,
          neighborhood: s.neighborhood,
          startsOn: s.starts_on,
          endsOn: s.ends_on,
          handoffModes: splitModes(s.handoff_modes),
          handoffSpotId: s.handoff_spot_id,
          status: s.status,
          itemCount: Number(s.item_count),
        }),
      ),
      saved: savedRows.map((r) => mapListing(r, true)),
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: unknown) =>
      z
        .object({
          neighborhood: z.string().max(80).nullable().optional(),
          zip: z.string().max(12).nullable().optional(),
        })
        .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    await sql`
      update profiles set
        neighborhood = coalesce(${data.neighborhood ?? null}, neighborhood),
        zip = coalesce(${data.zip ?? null}, zip)
      where id = ${context.userId}
    `;
    return ensureProfile(sql, context.userId);
  });

export const togglePremium = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = await ensureProfile(sql, context.userId);
    if (me.isPremium) {
      await sql`update profiles set is_premium = false where id = ${context.userId}`;
      return { isPremium: false };
    }
    const fees = await loadFees(sql);
    const switchFee = fees.find((row) => row.id === "premium_switch");
    const cost = switchFee?.enabled ? switchFee.amountCents : 400;
    if (me.walletCents < cost) {
      throw new Error(`Add more to your wallet to start Premium. See Fees.`);
    }
    await sql`update profiles set is_premium = true, wallet_cents = wallet_cents - ${cost} where id = ${context.userId}`;
    await sql`
      insert into wallet_tx (id, user_id, kind, amount_cents, note)
      values (${crypto.randomUUID()}, ${context.userId}, ${"premium"}, ${-cost}, ${"Rummlee Premium"})
    `;
    return { isPremium: true };
  });

export const topUpWallet = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((cents: unknown) => z.number().int().min(1000).max(20000).parse(cents))
  .handler(async ({ context, data: cents }) => {
    if (!TEST_MODE) {
      throw new Error("Real billing isn’t on. Beta uses test credits only.");
    }
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    await sql`update profiles set wallet_cents = wallet_cents + ${cents} where id = ${context.userId}`;
    await sql`
      insert into wallet_tx (id, user_id, kind, amount_cents, note)
      values (${crypto.randomUUID()}, ${context.userId}, ${"topup"}, ${cents}, ${"Test credits (beta — not real money)"})
    `;
    return ensureProfile(sql, context.userId);
  });

export const toggleSaved = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const existing = await sql<{ listing_id: string }>`
      select listing_id from saved_listings where user_id = ${context.userId} and listing_id = ${id}
    `;
    if (existing[0]) {
      await sql`delete from saved_listings where user_id = ${context.userId} and listing_id = ${id}`;
      return { saved: false };
    }
    await sql`insert into saved_listings (user_id, listing_id) values (${context.userId}, ${id})`;
    return { saved: true };
  });

const saleInput = z.object({
  name: z.string().min(3).max(80),
  kind: z.enum(["garage", "moving", "clearout"]),
  neighborhood: z.string().min(2).max(80),
  startsOn: z.string(),
  endsOn: z.string(),
  handoffModes: z.array(z.enum(["official", "public", "person", "porch"])).min(1),
  handoffSpotId: z.string().nullable().optional(),
});

export const createSale = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => saleInput.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfile(sql, context.userId);
    const id = crypto.randomUUID();
    let spotId = data.handoffSpotId ?? null;
    if (!spotId) {
      const match = await sql<{ id: string }>`
        select id from handoff_spots
        where area = ${data.neighborhood} or area like ${"%" + (data.neighborhood.split(",").pop()?.trim() ?? "")}
        order by case when kind = 'partner' then 0 else 1 end, name
        limit 1
      `;
      spotId = match[0]?.id ?? null;
    }
    const modes = splitModes(data.handoffModes.join(","));
    await sql`
      insert into sales (id, seller_id, name, kind, neighborhood, starts_on, ends_on, handoff_modes, handoff_spot_id, status)
      values (
        ${id}, ${context.userId}, ${data.name}, ${data.kind}, ${data.neighborhood},
        ${data.startsOn}::date, ${data.endsOn}::date, ${modes.join(",")},
        ${spotId}, ${"live"}
      )
    `;
    if (!me.neighborhood) {
      await sql`update profiles set neighborhood = ${data.neighborhood} where id = ${context.userId}`;
    }
    return { id };
  });

const listingInput = z.object({
  saleId: z.string(),
  title: z.string().min(2).max(80),
  description: z.string().max(600).optional(),
  priceCents: z.number().int().min(100),
  floorCents: z.number().int().min(100),
  buyNowCents: z.number().int().min(100).nullable().optional(),
  category: z.string(),
  condition: z.string(),
  haul: z.string(),
  photoUrl: z.string().min(4),
  handoffModes: z.array(z.enum(["official", "public", "person", "porch"])).min(1),
});

export const addListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => listingInput.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const fees = await loadFees(sql);
    const min = minAskingCents(fees);
    if (data.priceCents < min) {
      throw new Error(`Asking has to be at least $${(min / 100).toFixed(min % 100 === 0 ? 0 : 2)}.`);
    }
    if (data.floorCents > data.priceCents) {
      throw new Error("Lowest price can’t be higher than asking.");
    }
    if (data.floorCents < min) {
      throw new Error(`Lowest price has to be at least $${(min / 100).toFixed(min % 100 === 0 ? 0 : 2)}.`);
    }
    const listFee = fees.find((row) => row.id === "list");
    if (listFee?.enabled && listFee.amountCents > 0) {
      const seller = await ensureProfile(sql, context.userId);
      if (seller.walletCents < listFee.amountCents) {
        throw new Error("Add to your wallet to cover the list-an-item fee. See Fees.");
      }
      await sql`update profiles set wallet_cents = wallet_cents - ${listFee.amountCents} where id = ${context.userId}`;
      await sql`
        insert into wallet_tx (id, user_id, kind, amount_cents, note)
        values (${crypto.randomUUID()}, ${context.userId}, ${"list"}, ${-listFee.amountCents}, ${"List an item"})
      `;
    }
    const sale = await sql<{ id: string; seller_id: string; neighborhood: string }>`
      select id, seller_id, neighborhood from sales where id = ${data.saleId} and seller_id = ${context.userId}
    `;
    if (!sale[0]) throw new Error("Sale not found.");
    const id = crypto.randomUUID();
    await sql`
      insert into listings (
        id, sale_id, seller_id, title, description, price_cents, buy_now_cents, original_cents, floor_cents,
        category, condition, haul, neighborhood, handoff_modes, photo_url, status
      ) values (
        ${id}, ${data.saleId}, ${context.userId}, ${data.title}, ${data.description ?? ""},
        ${data.priceCents}, ${data.buyNowCents ?? data.priceCents}, ${null}, ${data.floorCents},
        ${data.category}, ${data.condition}, ${data.haul}, ${sale[0].neighborhood},
        ${splitModes(data.handoffModes.join(",")).join(",")}, ${data.photoUrl}, ${"live"}
      )
    `;
    return { id };
  });

export const sendOffer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        listingId: z.string(),
        amountCents: z.number().int().min(100),
        note: z.string().max(240).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const listing = await sql<{
      id: string;
      seller_id: string;
      price_cents: number;
      floor_cents: number | null;
      status: string;
      title: string;
    }>`select id, seller_id, price_cents, floor_cents, status, title from listings where id = ${data.listingId}`;
    const item = listing[0];
    if (!item || item.status !== "live") throw new Error("This item isn’t available.");
    if (item.seller_id === context.userId) throw new Error("You can’t offer on your own listing.");
    const existing = await sql<{ id: string; status: string }>`
      select id, status from offers where listing_id = ${data.listingId} and buyer_id = ${context.userId}
      order by created_at desc limit 1
    `;
    if (existing[0]) {
      throw new Error("You already used your one offer on this item. You can still pay asking.");
    }
    const ask = Number(item.price_cents);
    const floor = Number(item.floor_cents ?? item.price_cents);
    if (data.amountCents >= ask) {
      throw new Error("That’s asking or more. Pay asking to hold it.");
    }
    const id = crypto.randomUUID();
    let status: Offer["status"] = "pending";
    let declinedBy: "floor" | null = null;
    if (data.amountCents < floor) {
      status = "declined";
      declinedBy = "floor";
    } else if (isSeedUser(item.seller_id)) {
      status = "accepted";
    }
    await sql`
      insert into offers (id, listing_id, buyer_id, seller_id, amount_cents, counter_cents, status, declined_by, note)
      values (${id}, ${data.listingId}, ${context.userId}, ${item.seller_id}, ${data.amountCents}, ${null}, ${status}, ${declinedBy}, ${data.note ?? null})
    `;
    if (status === "accepted") {
      await sql`
        insert into messages (id, listing_id, from_id, to_id, body)
        values (
          ${crypto.randomUUID()}, ${data.listingId}, ${item.seller_id}, ${context.userId},
          ${"Yes. Pay to hold it, then we’ll confirm at the handoff location."}
        )
      `;
    }
    return { id, status, counterCents: null as number | null, declinedBy };
  });

export const respondOffer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        offerId: z.string(),
        action: z.enum(["accept", "decline", "counter"]),
        counterCents: z.number().int().min(100).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const rows = await sql<{
      id: string;
      listing_id: string;
      buyer_id: string;
      seller_id: string;
      status: string;
      floor_cents: number | null;
      price_cents: number;
    }>`
      select o.id, o.listing_id, o.buyer_id, o.seller_id, o.status,
             l.floor_cents, l.price_cents
      from offers o
      join listings l on l.id = o.listing_id
      where o.id = ${data.offerId}
    `;
    const offer = rows[0];
    if (!offer) throw new Error("Offer not found.");
    const isSeller = offer.seller_id === context.userId;
    const isBuyer = offer.buyer_id === context.userId;
    if (!isSeller && !isBuyer) throw new Error("Not your offer.");
    if (offer.status === "declined" || offer.status === "accepted") {
      throw new Error("This offer is already closed.");
    }
    if (data.action === "counter") {
      if (!isSeller) throw new Error("Only the seller can send a counteroffer.");
      if (offer.status !== "pending") throw new Error("You already sent one counteroffer.");
      if (!data.counterCents) throw new Error("Enter a counteroffer.");
      const floor = Number(offer.floor_cents ?? offer.price_cents);
      const ask = Number(offer.price_cents);
      if (data.counterCents < floor || data.counterCents > ask) {
        throw new Error("Counteroffer has to sit between your lowest and asking.");
      }
      await sql`
        update offers set status = ${"countered"}, counter_cents = ${data.counterCents}, updated_at = now()
        where id = ${offer.id}
      `;
      const dollars = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: data.counterCents % 100 === 0 ? 0 : 2,
      }).format(data.counterCents / 100);
      await sql`
        insert into messages (id, listing_id, from_id, to_id, body)
        values (
          ${crypto.randomUUID()}, ${offer.listing_id}, ${context.userId}, ${offer.buyer_id},
          ${`Counteroffer: ${dollars}. Pay that to hold it, or decline — that ends the offer.`}
        )
      `;
      return { ok: true };
    }
    if (data.action === "decline") {
      if (isSeller && offer.status !== "pending") {
        throw new Error("You already answered. One decline each.");
      }
      if (isBuyer && offer.status === "pending") {
        /* buyer walks away before a reply — their one pass */
      } else if (isBuyer && offer.status !== "countered") {
        throw new Error("This offer is already closed.");
      }
      const who = isSeller ? "seller" : "buyer";
      await sql`
        update offers set status = ${"declined"}, declined_by = ${who}, updated_at = now()
        where id = ${offer.id}
      `;
      return { ok: true };
    }
    if (!isSeller) throw new Error("Only the seller can say yes.");
    if (offer.status !== "pending" && offer.status !== "countered") {
      throw new Error("This offer is already closed.");
    }
    await sql`update offers set status = ${"accepted"}, updated_at = now() where id = ${offer.id}`;
    await sql`
      insert into messages (id, listing_id, from_id, to_id, body)
      values (
        ${crypto.randomUUID()}, ${offer.listing_id}, ${context.userId}, ${offer.buyer_id},
        ${"Yes. Pay to hold it, then we’ll confirm at the handoff location."}
      )
    `;
    return { ok: true };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ listingId: z.string(), body: z.string().min(1).max(500) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const listing = await sql<{ id: string; seller_id: string }>`
      select id, seller_id from listings where id = ${data.listingId}
    `;
    const item = listing[0];
    if (!item) throw new Error("Listing not found.");
    const toId = item.seller_id === context.userId
      ? (
          await sql<{ buyer_id: string }>`
            select buyer_id from offers where listing_id = ${data.listingId} and seller_id = ${context.userId}
            order by created_at desc limit 1
          `
        )[0]?.buyer_id
      : item.seller_id;
    if (!toId) throw new Error("No one to message yet.");
    if (toId === context.userId) throw new Error("That’s you.");
    await sql`
      insert into messages (id, listing_id, from_id, to_id, body)
      values (${crypto.randomUUID()}, ${data.listingId}, ${context.userId}, ${toId}, ${data.body.trim()})
    `;
    if (isSeedUser(toId)) {
      await sql`
        insert into messages (id, listing_id, from_id, to_id, body)
        values (
          ${crypto.randomUUID()}, ${data.listingId}, ${toId}, ${context.userId},
          ${"Still available. Meet at an official store handoff — locker or pickup desk, store hours. A public place or in person is optional if we both want it."}
        )
      `;
    }
    return { ok: true };
  });

export const buyNow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        listingId: z.string(),
        amountCents: z.number().int().min(100),
        handoffType: z.enum(["official", "person", "porch"]),
        meet: z.enum(["partner", "public", "person"]).optional(),
        handoffSpotId: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfile(sql, context.userId);
    const listing = await sql<{
      id: string;
      seller_id: string;
      title: string;
      status: string;
      price_cents: number;
      handoff_modes: string;
      neighborhood: string;
      handoff_spot_id: string | null;
    }>`
      select l.id, l.seller_id, l.title, l.status, l.price_cents, l.handoff_modes, l.neighborhood,
             s.handoff_spot_id
      from listings l
      join sales s on s.id = l.sale_id
      where l.id = ${data.listingId}
    `;
    const item = listing[0];
    if (!item || item.status !== "live") throw new Error("This item isn’t available.");
    if (item.seller_id === context.userId) throw new Error("That’s your listing.");
    const offerRows = await sql<{ status: string; amount_cents: number; counter_cents: number | null }>`
      select status, amount_cents, counter_cents from offers
      where listing_id = ${item.id} and buyer_id = ${context.userId}
      order by created_at desc limit 1
    `;
    const offer = offerRows[0];
    const asking = Number(item.price_cents);
    const base = payBaseCents(
      asking,
      offer
        ? {
            status: offer.status,
            amountCents: Number(offer.amount_cents),
            counterCents: offer.counter_cents == null ? null : Number(offer.counter_cents),
          }
        : null,
    );
    const fees = await loadFees(sql);
    const quote = checkoutQuote(
      fees,
      base,
      me.isPremium,
      data.meet === "person" ? "person" : data.meet === "public" ? "public" : "official",
    );
    const fee = quote.buyerFeeCents + quote.handoffFeeCents;
    const total = quote.youPayCents;
    const meet = data.meet ?? (canonicalizeMode(data.handoffType) === "person" ? "person" : "partner");
    let handoffType: HandoffMode = "official";
    let spotId: string | null = item.handoff_spot_id;
    const modes = splitModes(item.handoff_modes);
    if (meet === "person") {
      if (!modes.includes("person")) {
        throw new Error("In person handoff isn’t offered on this item. Pick another handoff location.");
      }
      handoffType = "person";
      spotId = null;
    } else if (meet === "public") {
      if (!modes.includes("public")) {
        throw new Error("Public place handoff isn’t offered on this item. Pick another handoff location.");
      }
      handoffType = "official";
      const wanted = data.handoffSpotId ?? null;
      const chosen = wanted
        ? await sql<{ id: string }>`
            select id from handoff_spots
            where id = ${wanted} and kind = ${"public"} and area = ${item.neighborhood}
            limit 1
          `
        : [];
      const fallback = chosen[0]
        ? chosen
        : await sql<{ id: string }>`
            select id from handoff_spots
            where kind = ${"public"} and area = ${item.neighborhood}
            order by name
            limit 1
          `;
      spotId = fallback[0]?.id ?? null;
      if (!spotId) throw new Error("No public place handoff in this neighborhood yet. Pick another handoff location.");
    } else {
      if (!modes.includes("official")) {
        throw new Error("Official store handoff isn’t offered on this item. Pick another handoff location.");
      }
    }
    if (me.walletCents < total) {
      throw new Error(
        TEST_MODE
          ? `Add ${Math.ceil((total - me.walletCents) / 100)} more test credits on You. Not real money.`
          : `Add ${Math.ceil((total - me.walletCents) / 100)} more to your wallet to pay.`,
      );
    }
    const code = pickupCode();
    const orderId = crypto.randomUUID();
    await sql`update listings set status = ${"held"} where id = ${item.id} and status = ${"live"}`;
    await sql`
      insert into orders (id, listing_id, buyer_id, seller_id, amount_cents, fee_cents, status, pickup_code, handoff_type, handoff_spot_id, buyer_confirmed, seller_confirmed)
      values (${orderId}, ${item.id}, ${context.userId}, ${item.seller_id}, ${base}, ${fee}, ${"escrow"}, ${code}, ${handoffType}, ${spotId}, ${false}, ${isSeedUser(item.seller_id)})
    `;
    await sql`update profiles set wallet_cents = wallet_cents - ${total} where id = ${context.userId}`;
    await sql`
      insert into wallet_tx (id, user_id, kind, amount_cents, ref_id, note)
      values (${crypto.randomUUID()}, ${context.userId}, ${"hold"}, ${-total}, ${orderId}, ${
        TEST_MODE ? "Test hold (beta — not real money) — " + item.title : "Held until pickup — " + item.title
      })
    `;
    await sql`
      update offers set status = ${"declined"}, updated_at = now()
      where listing_id = ${item.id} and status in (${"pending"}, ${"countered"})
    `;
    return { orderId, pickupCode: code, feeCents: fee };
  });

export const confirmPickup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ orderId: z.string(), code: z.string().min(3) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const rows = await sql<{
      id: string;
      listing_id: string;
      buyer_id: string;
      seller_id: string;
      amount_cents: number;
      fee_cents: number;
      status: string;
      pickup_code: string;
      buyer_confirmed: boolean;
      seller_confirmed: boolean;
    }>`select id, listing_id, buyer_id, seller_id, amount_cents, fee_cents, status, pickup_code, buyer_confirmed, seller_confirmed from orders where id = ${data.orderId}`;
    const order = rows[0];
    if (!order) throw new Error("Pickup not found.");
    if (order.status !== "escrow") throw new Error("Already finished.");
    const normalized = data.code.replace(/\s|-/g, "").toUpperCase();
    const expect = order.pickup_code.replace(/\s|-/g, "").toUpperCase();
    if (normalized !== expect) throw new Error("That scan code doesn’t match.");
    const isBuyer = order.buyer_id === context.userId;
    const isSeller = order.seller_id === context.userId;
    if (!isBuyer && !isSeller) throw new Error("Not your pickup.");
    const buyerOk = isBuyer || Boolean(order.buyer_confirmed);
    const sellerOk = isSeller || Boolean(order.seller_confirmed) || isSeedUser(order.seller_id);
    await sql`
      update orders set
        buyer_confirmed = ${buyerOk},
        seller_confirmed = ${sellerOk}
      where id = ${order.id}
    `;
    if (buyerOk && sellerOk) {
      await sql`update orders set status = ${"picked_up"} where id = ${order.id}`;
      await sql`update listings set status = ${"sold"} where id = ${order.listing_id}`;
      await sql`update profiles set wallet_cents = wallet_cents + ${Number(order.amount_cents)} where id = ${order.seller_id}`;
      await sql`
        insert into wallet_tx (id, user_id, kind, amount_cents, ref_id, note)
        values (${crypto.randomUUID()}, ${order.seller_id}, ${"payout"}, ${Number(order.amount_cents)}, ${order.id}, ${
          TEST_MODE ? "Test payout (beta — not real money)" : "Sale payout"
        })
      `;
      return { done: true };
    }
    return { done: false };
  });

export const getInbox = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<InboxPayload> => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const offerRows = await sql<{
      id: string;
      listing_id: string;
      listing_title: string;
      listing_photo: string;
      listing_price_cents: number;
      buyer_id: string;
      buyer_handle: string;
      seller_id: string;
      seller_handle: string;
      amount_cents: number;
      counter_cents: number | null;
      status: Offer["status"];
      declined_by: string | null;
      note: string | null;
      created_at: string;
    }>`
      select o.id, o.listing_id, l.title as listing_title, l.photo_url as listing_photo,
             l.price_cents as listing_price_cents,
             o.buyer_id, b.handle as buyer_handle, o.seller_id, se.handle as seller_handle,
             o.amount_cents, o.counter_cents, o.status, o.declined_by, o.note, o.created_at
      from offers o
      join listings l on l.id = o.listing_id
      join profiles b on b.id = o.buyer_id
      join profiles se on se.id = o.seller_id
      where o.buyer_id = ${context.userId} or o.seller_id = ${context.userId}
      order by o.updated_at desc
    `;
    const mapO = (r: (typeof offerRows)[number]): Offer => ({
      id: r.id,
      listingId: r.listing_id,
      listingTitle: r.listing_title,
      listingPhoto: r.listing_photo,
      listingPriceCents: Number(r.listing_price_cents),
      buyerId: r.buyer_id,
      buyerHandle: r.buyer_handle,
      sellerId: r.seller_id,
      sellerHandle: r.seller_handle,
      amountCents: Number(r.amount_cents),
      counterCents: r.counter_cents == null ? null : Number(r.counter_cents),
      status: r.status,
      declinedBy: r.declined_by === "buyer" || r.declined_by === "seller" || r.declined_by === "floor" ? r.declined_by : null,
      note: r.note,
      createdAt: r.created_at,
    });
    const orders = await sql<{
      id: string;
      listing_id: string;
      listing_title: string;
      listing_photo: string;
      buyer_id: string;
      buyer_handle: string;
      seller_id: string;
      seller_handle: string;
      amount_cents: number;
      fee_cents: number;
      status: Order["status"];
      pickup_code: string;
      buyer_confirmed: boolean;
      seller_confirmed: boolean;
      handoff_type: Order["handoffType"];
      created_at: string;
    }>`
      select o.id, o.listing_id, l.title as listing_title, l.photo_url as listing_photo,
             o.buyer_id, b.handle as buyer_handle, o.seller_id, se.handle as seller_handle,
             o.amount_cents, o.fee_cents, o.status, o.pickup_code, o.buyer_confirmed, o.seller_confirmed,
             o.handoff_type, o.created_at
      from orders o
      join listings l on l.id = o.listing_id
      join profiles b on b.id = o.buyer_id
      join profiles se on se.id = o.seller_id
      where o.buyer_id = ${context.userId} or o.seller_id = ${context.userId}
      order by o.created_at desc
    `;
    const messages = await sql<{
      id: string;
      listing_id: string;
      listing_title: string;
      from_id: string;
      from_handle: string;
      to_id: string;
      body: string;
      created_at: string;
    }>`
      select m.id, m.listing_id, l.title as listing_title, m.from_id, p.handle as from_handle,
             m.to_id, m.body, m.created_at
      from messages m
      join listings l on l.id = m.listing_id
      join profiles p on p.id = m.from_id
      where m.from_id = ${context.userId} or m.to_id = ${context.userId}
      order by m.created_at desc
      limit 40
    `;
    return {
      offersIn: offerRows.filter((o) => o.seller_id === context.userId).map(mapO),
      offersOut: offerRows.filter((o) => o.buyer_id === context.userId).map(mapO),
      orders: orders.map((o) => ({
        id: o.id,
        listingId: o.listing_id,
        listingTitle: o.listing_title,
        listingPhoto: o.listing_photo,
        buyerId: o.buyer_id,
        buyerHandle: o.buyer_handle,
        sellerId: o.seller_id,
        sellerHandle: o.seller_handle,
        amountCents: Number(o.amount_cents),
        feeCents: Number(o.fee_cents),
        status: o.status,
        pickupCode: o.pickup_code,
        buyerConfirmed: Boolean(o.buyer_confirmed),
        sellerConfirmed: Boolean(o.seller_confirmed),
        handoffType: canonicalizeMode(o.handoff_type) ?? "official",
        createdAt: o.created_at,
      })),
      messages: messages.map((m) => ({
        id: m.id,
        listingId: m.listing_id,
        listingTitle: m.listing_title,
        fromId: m.from_id,
        fromHandle: m.from_handle,
        toId: m.to_id,
        body: m.body,
        createdAt: m.created_at,
      })),
    };
  });

export const getOrder = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const rows = await sql<{
      id: string;
      listing_id: string;
      listing_title: string;
      listing_photo: string;
      buyer_id: string;
      buyer_handle: string;
      seller_id: string;
      seller_handle: string;
      amount_cents: number;
      fee_cents: number;
      status: Order["status"];
      pickup_code: string;
      buyer_confirmed: boolean;
      seller_confirmed: boolean;
      handoff_type: Order["handoffType"];
      created_at: string;
    }>`
      select o.id, o.listing_id, l.title as listing_title, l.photo_url as listing_photo,
             o.buyer_id, b.handle as buyer_handle, o.seller_id, se.handle as seller_handle,
             o.amount_cents, o.fee_cents, o.status, o.pickup_code, o.buyer_confirmed, o.seller_confirmed,
             o.handoff_type, o.created_at
      from orders o
      join listings l on l.id = o.listing_id
      join profiles b on b.id = o.buyer_id
      join profiles se on se.id = o.seller_id
      where o.id = ${id} and (o.buyer_id = ${context.userId} or o.seller_id = ${context.userId})
    `;
    const o = rows[0];
    if (!o) return null;
    return {
      id: o.id,
      listingId: o.listing_id,
      listingTitle: o.listing_title,
      listingPhoto: o.listing_photo,
      buyerId: o.buyer_id,
      buyerHandle: o.buyer_handle,
      sellerId: o.seller_id,
      sellerHandle: o.seller_handle,
      amountCents: Number(o.amount_cents),
      feeCents: Number(o.fee_cents),
      status: o.status,
      pickupCode: o.pickup_code,
      buyerConfirmed: Boolean(o.buyer_confirmed),
      sellerConfirmed: Boolean(o.seller_confirmed),
      handoffType: o.handoff_type,
      createdAt: o.created_at,
    } satisfies Order;
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (isSeedUser(context.userId)) {
      throw new Error("Demo neighbors can’t be deleted.");
    }
    const sql = await getSql();
    const uid = context.userId;
    await sql`
      delete from saved_listings
      where user_id = ${uid}
         or listing_id in (select id from listings where seller_id = ${uid})
    `;
    await sql`
      delete from messages
      where from_id = ${uid}
         or to_id = ${uid}
         or listing_id in (select id from listings where seller_id = ${uid})
    `;
    await sql`delete from offers where buyer_id = ${uid} or seller_id = ${uid}`;
    await sql`delete from orders where buyer_id = ${uid} or seller_id = ${uid}`;
    await sql`delete from listings where seller_id = ${uid}`;
    await sql`delete from sales where seller_id = ${uid}`;
    await sql`delete from wallet_tx where user_id = ${uid}`;
    await sql`delete from profiles where id = ${uid}`;
    await sql.query(`delete from "user" where id = $1`, [uid]);
    return { ok: true as const };
  });

export const getFeeTable = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  await ensureSeed(sql);
  const userId = await optionalUserId();
  let isStaff = false;
  let canClaim = false;
  if (userId) {
    const me = await ensureProfile(sql, userId);
    isStaff = me.isStaff;
    const staff = await sql<{ n: number }>`select count(*)::int as n from profiles where is_staff = true`;
    canClaim = !isStaff && Number(staff[0]?.n ?? 0) === 0;
  }
  return { fees: await loadFees(sql), isStaff, canClaim, signedIn: Boolean(userId) };
});

export const claimOperator = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureSeed(sql);
    const staff = await sql<{ n: number }>`select count(*)::int as n from profiles where is_staff = true`;
    if (Number(staff[0]?.n ?? 0) > 0) {
      throw new Error("An operator account is already set.");
    }
    await ensureProfile(sql, context.userId);
    await sql`update profiles set is_staff = true where id = ${context.userId}`;
    return { ok: true as const };
  });

export const saveFee = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        percentBps: z.number().int().min(0).max(10000).optional(),
        amountCents: z.number().int().min(0).max(10_000_000).optional(),
        enabled: z.boolean().optional(),
        label: z.string().min(1).max(80).optional(),
        description: z.string().min(1).max(400).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureSeed(sql);
    const me = await ensureProfile(sql, context.userId);
    if (!me.isStaff) throw new Error("Only the operator can change the fee table.");
    const current = await sql<{ id: string }>`select id from rummlee_fees where id = ${data.id}`;
    if (!current[0]) throw new Error("Unknown fee.");
    await sql`
      update rummlee_fees set
        percent_bps = coalesce(${data.percentBps ?? null}, percent_bps),
        amount_cents = coalesce(${data.amountCents ?? null}, amount_cents),
        enabled = coalesce(${data.enabled ?? null}, enabled),
        label = coalesce(${data.label ?? null}, label),
        description = coalesce(${data.description ?? null}, description),
        updated_at = now()
      where id = ${data.id}
    `;
    return { fees: await loadFees(sql) };
  });


import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureFees, ensureSeed } from "./seed";
import { storePhoto } from "./photo-store";
import { feeOn, fitsOfficialCounter, isSeedUser, looksLikeAccountLabel, makeHandle, normalizeHandle, parseSpotKind, payBaseCents, pickupCode, partyScan, splitModes, canonicalizeMode, cityOf, saleIsUpcoming } from "./format";
import { checkoutQuote, countSaleDays, feeById, mapFeeRow, minAskingCents, quoteSaleDays, type FeeRow } from "./fees";
import { CITIES, IDENTITY_CAP, IDENTITY_ENABLED, MAX_SALE_DAYS, MIN_PRICE_CENTS, NEIGHBORHOODS, PHOTO_FILL_ENABLED, SALE_ITEM_CAP, TEST_MODE, TEST_STARTER_CENTS, resolveListingId, saleDayAllowance } from "./constants";
import { beginIdentity, finishIdentity } from "./identity";
import { suggestFromPhoto } from "./photo-fill";
import { childIds, holdBundleChildren, releaseBundleChildren, soldBundleChildren, useBundleOffers, voidBuyerBundlesContaining } from "./bundles";
import { overallThumb, type Thumb } from "./trust";
import { PAYOUT_HOLD_HOURS, chargeSeller, releaseDuePayouts, writeLedger, writeNotice, refundEscrow } from "./books";
import { claimHouseShelf, houseForSpot, releaseHouseClaim } from "./house";
import { awardCleanRun, grantRep } from "./rep";
import { ensureApproach } from "./approach";
import { notifyNewListing, notifyNewSale } from "./alerts";
import { roughDistance, SPOT_ADDRESS } from "./distance";
import type {
  HandoffMode,
  HandoffSpot,
  InboxPayload,
  Listing,
  Message,
  Notice,
  Offer,
  Order,
  PendingRate,
  Profile,
  ReceivedDown,
  Sale,
  SaleChannel,
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
  size_label: string | null;
  pack: string | null;
  weight_lbs: number | null;
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
  seller_verified?: boolean;
  seller_thumbs_up?: number;
  seller_thumbs_down?: number;
  seller_rep?: number | null;
  online_start_dow?: number | null;
  online_end_dow?: number | null;
  live_on?: boolean | null;
  live_start_dow?: number | null;
  live_end_dow?: number | null;
  live_open?: string | null;
  live_close?: string | null;
  always_on?: boolean | null;
  charity_split?: boolean | null;
  overtime_cents?: number | null;
  featured?: boolean | null;
  sale_featured?: boolean | null;
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
    sizeLabel: row.size_label?.trim() ? row.size_label.trim() : null,
    pack: row.pack === "box" || row.pack === "as_is" ? row.pack : null,
    weightLbs: row.weight_lbs == null ? null : Number(row.weight_lbs),
    neighborhood: row.neighborhood,
    handoffModes: fitsOfficialCounter({
      pack: row.pack,
      weightLbs: row.weight_lbs == null ? null : Number(row.weight_lbs),
      haul: row.haul,
    })
      ? splitModes(row.handoff_modes)
      : ["person"],
    handoffSpotName: row.handoff_spot_name,
    handoffSpotArea: row.handoff_spot_area,
    handoffSpotHint: row.handoff_spot_hint,
    handoffSpotKind: parseSpotKind(row.handoff_spot_kind),
    photoUrl: row.photo_url,
    status: row.status,
    saleStartsOn: row.starts_on,
    saleEndsOn: row.ends_on,
    saved,
    sellerVerified: Boolean(row.seller_verified),
    sellerThumbsUp: Number(row.seller_thumbs_up ?? 0),
    sellerThumbsDown: Number(row.seller_thumbs_down ?? 0),
    sellerRep: Number(row.seller_rep ?? 100),
    onlineStartDow: row.online_start_dow == null ? null : Number(row.online_start_dow),
    onlineEndDow: row.online_end_dow == null ? null : Number(row.online_end_dow),
    liveOn: Boolean(row.live_on),
    liveStartDow: row.live_start_dow == null ? null : Number(row.live_start_dow),
    liveEndDow: row.live_end_dow == null ? null : Number(row.live_end_dow),
    liveOpen: row.live_open ?? null,
    liveClose: row.live_close ?? null,
    alwaysOn: Boolean(row.always_on),
    charitySplit: Boolean(row.charity_split),
    featured: Boolean(row.featured) || Boolean(row.sale_featured),
    overtimeCents: row.overtime_cents == null ? null : Number(row.overtime_cents),
  };
}

async function viewerNeighborhood(sql: Awaited<ReturnType<typeof getSql>>, userId: string | null) {
  if (!userId) return null;
  const rows = await sql<{ neighborhood: string | null }>`select neighborhood from profiles where id = ${userId}`;
  return rows[0]?.neighborhood ?? null;
}

function withDistance(listing: Listing, from: string | null): Listing {
  return { ...listing, distanceLabel: roughDistance(from, listing.handoffSpotArea || listing.neighborhood) };
}

function forViewer(listing: Listing, opts: { mine: boolean; trio: boolean }): Listing {
  let next = listing;
  if (!(opts.mine || opts.trio) && next.overtimeCents != null) next = { ...next, overtimeCents: null };
  if (!saleIsUpcoming(next.saleStartsOn, next.alwaysOn)) return next;
  next = { ...next, upcoming: true };
  if (opts.mine) return next;
  return {
    ...next,
    priceHidden: true,
    priceCents: 0,
    buyNowCents: null,
    originalCents: null,
    overtimeCents: null,
  };
}

function safePhoto(url: string) {
  if (url.startsWith("/listings/")) {
    throw new Error("Use your own photo. Sample listing pictures can’t be reused.");
  }
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(url) && url.length < 1_500_000) return url;
  throw new Error("Use a JPEG, PNG, or WebP photo.");
}

async function debitWallet(sql: Awaited<ReturnType<typeof getSql>>, userId: string, cents: number) {
  if (cents <= 0) return;
  const rows = await sql<{ id: string }>`
    update profiles set wallet_cents = wallet_cents - ${cents}
    where id = ${userId} and wallet_cents >= ${cents}
    returning id
  `;
  if (!rows[0]) throw new Error("Not enough in the wallet for that.");
}

export async function optionalUserId() {
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

function profileReady(p: { handle?: string | null; neighborhood?: string | null; legalFirstName?: string | null; legalLastName?: string | null; phone?: string | null }) {
  return Boolean(p.handle && p.neighborhood && p.legalFirstName && p.legalLastName && p.phone);
}

function mapProfile(p: {
  id: string;
  handle: string;
  neighborhood: string | null;
  zip: string | null;
  city?: string | null;
  legal_first_name?: string | null;
  legal_last_name?: string | null;
  phone?: string | null;
  isPremium: boolean;
  plusPlan: "month" | "year" | null;
  plusTier: "plus" | "trio" | null;
  plusUntil: string | null;
  isStaff: boolean;
  walletCents: number;
  verified: boolean;
  thumbsUp: number;
  thumbsDown: number;
  rep?: number;
}): Profile {
  const legalFirstName = p.legal_first_name?.trim() || null;
  const legalLastName = p.legal_last_name?.trim() || null;
  const phone = p.phone?.trim() || null;
  return {
    id: p.id,
    handle: p.handle,
    neighborhood: p.neighborhood,
    zip: p.zip,
    city: p.city?.trim() || null,
    legalFirstName,
    legalLastName,
    phone,
    profileComplete: profileReady({ handle: p.handle, neighborhood: p.neighborhood, legalFirstName, legalLastName, phone }),
    isPremium: p.isPremium,
    plusPlan: p.plusPlan,
    plusTier: p.plusTier,
    plusUntil: p.plusUntil,
    isStaff: p.isStaff,
    walletCents: p.walletCents,
    verified: p.verified,
    thumbsUp: p.thumbsUp,
    thumbsDown: p.thumbsDown,
    rep: Number(p.rep ?? 100),
  };
}

function plusActive(isPremium: boolean, plusUntil: string | Date | null) {
  if (!isPremium) return false;
  if (!plusUntil) return true;
  return new Date(plusUntil).getTime() > Date.now();
}

async function viewerTier(sql: Awaited<ReturnType<typeof getSql>>, userId: string | null) {
  if (!userId) return null;
  const rows = await sql<{ is_premium: boolean; plus_until: string | null; plus_tier: string | null }>`
    select is_premium, plus_until, plus_tier from profiles where id = ${userId}
  `;
  if (!plusActive(Boolean(rows[0]?.is_premium), rows[0]?.plus_until ?? null)) return null;
  return rows[0]?.plus_tier === "trio" ? "trio" : "plus";
}

async function viewerPremium(sql: Awaited<ReturnType<typeof getSql>>, userId: string | null) {
  return (await viewerTier(sql, userId)) != null;
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

export async function ensureProfile(sql: Awaited<ReturnType<typeof getSql>>, userId: string): Promise<Profile> {
  const existing = await sql<{
    id: string;
    handle: string;
    neighborhood: string | null;
    zip: string | null;
    city: string | null;
    legal_first_name: string | null;
    legal_last_name: string | null;
    phone: string | null;
    is_premium: boolean;
    plus_plan: string | null;
    plus_tier: string | null;
    plus_until: string | null;
    is_staff: boolean;
    wallet_cents: number;
    verified_at: string | null;
    thumbs_up: number | null;
    thumbs_down: number | null;
    rep: number | null;
    deleted_at: string | null;
  }>`select id, handle, neighborhood, zip, city, legal_first_name, legal_last_name, phone, is_premium, plus_plan, plus_tier, plus_until, is_staff, wallet_cents, verified_at, thumbs_up, thumbs_down, rep, deleted_at from profiles where id = ${userId}`;
  if (existing[0]?.deleted_at) {
    throw new Error("This account is closed. Sale records stay on file. Email support to reopen.");
  }
  if (existing[0]) {
    const p = existing[0];
    let handle = p.handle;
    if (looksLikeAccountLabel(handle)) {
      handle = makeHandle();
      for (let i = 0; i < 8; i += 1) {
        const clash = await sql<{ id: string }>`select id from profiles where handle = ${handle}`;
        if (!clash[0]) break;
        handle = makeHandle();
      }
      await sql`update profiles set handle = ${handle} where id = ${userId}`;
    }
    const walletCents = await grantTestCredits(sql, userId, Number(p.wallet_cents));
    const isPremium = plusActive(Boolean(p.is_premium), p.plus_until);
    await syncIdentity(sql, userId);
    const thumbs = await sql<{ thumbs_up: number; thumbs_down: number }>`
      select thumbs_up, thumbs_down from profiles where id = ${userId}
    `;
    return mapProfile({
      id: p.id,
      handle,
      neighborhood: p.neighborhood,
      zip: p.zip,
      city: p.city,
      legal_first_name: p.legal_first_name,
      legal_last_name: p.legal_last_name,
      phone: p.phone,
      isPremium,
      plusPlan: p.plus_plan === "year" || p.plus_plan === "month" ? p.plus_plan : null,
      plusTier: isPremium ? (p.plus_tier === "trio" ? "trio" : "plus") : null,
      plusUntil: p.plus_until,
      isStaff: Boolean(p.is_staff),
      walletCents,
      verified: Boolean(p.verified_at),
      thumbsUp: Number(thumbs[0]?.thumbs_up ?? p.thumbs_up ?? 0),
      thumbsDown: Number(thumbs[0]?.thumbs_down ?? p.thumbs_down ?? 0),
      rep: Number(p.rep ?? 100),
    });
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
  await syncIdentity(sql, userId);
  const thumbs = await sql<{ thumbs_up: number; thumbs_down: number }>`
    select thumbs_up, thumbs_down from profiles where id = ${userId}
  `;
  return mapProfile({
    id: userId,
    handle,
    neighborhood: null,
    zip: null,
    city: null,
    legal_first_name: null,
    legal_last_name: null,
    phone: null,
    isPremium: false,
    plusPlan: null,
    plusTier: null,
    plusUntil: null,
    isStaff: false,
    walletCents: start,
    verified: false,
    thumbsUp: Number(thumbs[0]?.thumbs_up ?? 0),
    thumbsDown: Number(thumbs[0]?.thumbs_down ?? 0),
    rep: 100,
  });
}

async function recountThumbs(sql: Awaited<ReturnType<typeof getSql>>, userId: string) {
  const rows = await sql<{ overall: string; status: string | null }>`
    select r.overall, c.status
    from ratings r
    left join rating_challenges c on c.rating_id = r.id
    where r.subject_id = ${userId}
  `;
  let up = 0;
  let down = 0;
  for (const r of rows) {
    if (r.status === "removed" || r.status === "open") continue;
    if (r.overall === "up") up += 1;
    else down += 1;
  }
  await sql`update profiles set thumbs_up = ${up}, thumbs_down = ${down} where id = ${userId}`;
  await sql`
    update identity_locks set thumbs_up = ${up}, thumbs_down = ${down}, updated_at = now()
    where profile_id = ${userId}
  `;
}

function parseChannel(raw: string | null | undefined): SaleChannel {
  if (raw === "physical" || raw === "both" || raw === "online") return raw;
  return "online";
}

type SaleMapRow = {
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
  channel?: string | null;
  physical_location?: string | null;
  hours_start?: string | null;
  hours_end?: string | null;
  online_start_dow?: number | null;
  online_end_dow?: number | null;
  live_on?: boolean | null;
  live_start_dow?: number | null;
  live_end_dow?: number | null;
  live_open?: string | null;
  live_close?: string | null;
  always_on?: boolean | null;
  featured?: boolean | null;
};

function mapSale(s: SaleMapRow): Sale {
  return {
    id: s.id,
    sellerId: s.seller_id,
    sellerHandle: s.seller_handle,
    name: s.name,
    kind: s.kind,
    neighborhood: s.neighborhood,
    startsOn: s.starts_on,
    endsOn: s.ends_on,
    channel: parseChannel(s.channel),
    physicalLocation: null,
    hoursStart: s.hours_start ?? null,
    hoursEnd: s.hours_end ?? null,
    handoffModes: splitModes(s.handoff_modes),
    handoffSpotId: s.handoff_spot_id,
    status: s.status,
    itemCount: Number(s.item_count),
    onlineStartDow: s.online_start_dow == null ? null : Number(s.online_start_dow),
    onlineEndDow: s.online_end_dow == null ? null : Number(s.online_end_dow),
    liveOn: Boolean(s.live_on),
    liveStartDow: s.live_start_dow == null ? null : Number(s.live_start_dow),
    liveEndDow: s.live_end_dow == null ? null : Number(s.live_end_dow),
    liveOpen: s.live_open ?? null,
    liveClose: s.live_close ?? null,
    alwaysOn: Boolean(s.always_on),
    featured: Boolean(s.featured),
  };
}

async function sellerMeetupNote(sql: Awaited<ReturnType<typeof getSql>>, saleId: string) {
  const rows = await sql<{ meetup_note: string | null }>`select meetup_note from sales where id = ${saleId}`;
  const note = rows[0]?.meetup_note?.trim();
  return note || null;
}

async function meetupNoteForViewer(
  sql: Awaited<ReturnType<typeof getSql>>,
  args: { userId: string | null; sellerId: string; saleId: string; listingId: string; modes: string },
) {
  const note = await sellerMeetupNote(sql, args.saleId);
  if (!note || !args.userId) return null;
  if (args.userId === args.sellerId) return note;
  if (!splitModes(args.modes).includes("person")) return null;
  const paid = await sql<{ id: string }>`
    select id from orders
    where listing_id = ${args.listingId} and buyer_id = ${args.userId}
      and handoff_type = ${"person"} and status <> ${"cancelled"}
    limit 1
  `;
  return paid[0] ? note : null;
}

function hashIdentity(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

async function fingerprintsFor(sql: Awaited<ReturnType<typeof getSql>>, userId: string) {
  const emails = await sql.query<{ email: string }>(`select email from "user" where id = $1`, [userId]);
  const accounts = await sql.query<{ provider: string; account: string }>(
    `select "providerId" as provider, "accountId" as account from account where "userId" = $1`,
    [userId],
  );
  const out: { fingerprint: string; kind: string }[] = [];
  const email = emails[0]?.email?.trim().toLowerCase();
  if (email) out.push({ fingerprint: hashIdentity(`email:${email}`), kind: "email" });
  for (const row of accounts) {
    if (row.provider && row.account) {
      out.push({ fingerprint: hashIdentity(`oauth:${row.provider}:${row.account}`), kind: "oauth" });
    }
  }
  return out;
}

/** Ratings follow the ID. A new account with the same email/sign-in does not start at zero. */
async function syncIdentity(sql: Awaited<ReturnType<typeof getSql>>, userId: string) {
  const fps = await fingerprintsFor(sql, userId);
  if (!fps.length) return;
  let up = 0;
  let down = 0;
  let saw = false;
  for (const fp of fps) {
    const rows = await sql<{
      profile_id: string;
      thumbs_up: number;
      thumbs_down: number;
    }>`
      select profile_id, thumbs_up, thumbs_down from identity_locks where fingerprint = ${fp.fingerprint}
    `;
    const lock = rows[0];
    if (!lock) continue;
    saw = true;
    up = Number(lock.thumbs_up);
    down = Number(lock.thumbs_down);
    if (lock.profile_id !== userId) {
      const alive = await sql<{ id: string }>`select id from profiles where id = ${lock.profile_id}`;
      if (!alive[0]) {
        await sql`update ratings set subject_id = ${userId} where subject_id = ${lock.profile_id}`;
      }
    }
  }
  if (saw) {
    await sql`update profiles set thumbs_up = ${up}, thumbs_down = ${down} where id = ${userId}`;
  }
  const me = await sql<{ thumbs_up: number; thumbs_down: number }>`
    select thumbs_up, thumbs_down from profiles where id = ${userId}
  `;
  const tUp = Number(me[0]?.thumbs_up ?? 0);
  const tDown = Number(me[0]?.thumbs_down ?? 0);
  for (const fp of fps) {
    const existing = await sql<{ profile_id: string }>`
      select profile_id from identity_locks where fingerprint = ${fp.fingerprint}
    `;
    if (!existing[0]) {
      await sql`
        insert into identity_locks (fingerprint, kind, profile_id, active, thumbs_up, thumbs_down)
        values (${fp.fingerprint}, ${fp.kind}, ${userId}, ${false}, ${tUp}, ${tDown})
      `;
    } else {
      await sql`
        update identity_locks
        set thumbs_up = ${tUp}, thumbs_down = ${tDown}, updated_at = now()
        where fingerprint = ${fp.fingerprint}
      `;
    }
  }
}

async function assertIdAvailable(sql: Awaited<ReturnType<typeof getSql>>, userId: string) {
  const fps = await fingerprintsFor(sql, userId);
  for (const fp of fps) {
    const rows = await sql<{ profile_id: string; active: boolean }>`
      select profile_id, active from identity_locks where fingerprint = ${fp.fingerprint}
    `;
    const lock = rows[0];
    if (lock?.active && lock.profile_id !== userId) {
      throw new Error(
        "This ID already has a live account. One account at a time. Email support to reset — ratings stay with the ID.",
      );
    }
  }
}

async function claimIdentity(sql: Awaited<ReturnType<typeof getSql>>, userId: string) {
  const fps = await fingerprintsFor(sql, userId);
  const me = await sql<{ thumbs_up: number; thumbs_down: number }>`
    select thumbs_up, thumbs_down from profiles where id = ${userId}
  `;
  const tUp = Number(me[0]?.thumbs_up ?? 0);
  const tDown = Number(me[0]?.thumbs_down ?? 0);
  for (const fp of fps) {
    await sql`
      insert into identity_locks (fingerprint, kind, profile_id, active, thumbs_up, thumbs_down, released_at)
      values (${fp.fingerprint}, ${fp.kind}, ${userId}, ${true}, ${tUp}, ${tDown}, ${null})
      on conflict (fingerprint) do update set
        profile_id = ${userId},
        active = true,
        thumbs_up = ${tUp},
        thumbs_down = ${tDown},
        released_at = null,
        updated_at = now()
    `;
  }
}

async function freeSaleDaysUsed(sql: Awaited<ReturnType<typeof getSql>>, userId: string) {
  const rows = await sql<{ used: number }>`
    select coalesce(sum(sale_free_days), 0)::int as used
    from sales
    where seller_id = ${userId}
      and created_at >= date_trunc('month', now())
  `;
  return Number(rows[0]?.used ?? 0);
}

async function loadPendingRates(sql: Awaited<ReturnType<typeof getSql>>, userId: string): Promise<PendingRate[]> {
  const rows = await sql<{
    id: string;
    listing_title: string;
    listing_photo: string;
    other_handle: string;
    role: "buyer" | "seller";
    handoff_type: string;
  }>`
    select o.id, l.title as listing_title, l.photo_url as listing_photo,
           case when o.buyer_id = ${userId} then se.handle else b.handle end as other_handle,
           case when o.buyer_id = ${userId} then ${"buyer"} else ${"seller"} end as role,
           o.handoff_type
    from orders o
    join listings l on l.id = o.listing_id
    join profiles b on b.id = o.buyer_id
    join profiles se on se.id = o.seller_id
    where o.status = ${"picked_up"}
      and (o.buyer_id = ${userId} or o.seller_id = ${userId})
      and not exists (select 1 from ratings r where r.order_id = o.id and r.rater_id = ${userId})
    order by o.created_at desc
    limit 12
  `;
  return rows.map((r) => ({
    orderId: r.id,
    listingTitle: r.listing_title,
    listingPhoto: r.listing_photo,
    otherHandle: r.other_handle,
    role: r.role,
    handoffType: r.handoff_type,
  }));
}

const listingSelect = `
  select l.id, l.sale_id, s.name as sale_name, l.seller_id, p.handle as seller_handle,
         l.title, l.description, l.price_cents, l.buy_now_cents, l.original_cents, l.floor_cents,
         l.category, l.condition, l.haul, l.size_label, l.pack, l.weight_lbs, l.neighborhood, l.handoff_modes, l.photo_url,
         l.status, l.charity_split, l.overtime_cents, s.starts_on, s.ends_on,
         (l.featured_until is not null and l.featured_until > now()) as featured,
         (s.featured_until is not null and s.featured_until > now()) as sale_featured,
         s.online_start_dow, s.online_end_dow, s.live_on, s.live_start_dow, s.live_end_dow, s.live_open, s.live_close, s.always_on,
         hs.name as handoff_spot_name, hs.area as handoff_spot_area, hs.hint as handoff_spot_hint,
         hs.kind as handoff_spot_kind,
         (p.verified_at is not null) as seller_verified,
         coalesce(p.thumbs_up, 0) as seller_thumbs_up,
         coalesce(p.thumbs_down, 0) as seller_thumbs_down,
         coalesce(p.rep, 100) as seller_rep
  from listings l
  join sales s on s.id = l.sale_id
  join profiles p on p.id = l.seller_id
  left join handoff_spots hs on hs.id = s.handoff_spot_id
`;

export const bootstrapPublic = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  await ensureSeed(sql);
  const userId = await optionalUserId();
  const tier = await viewerTier(sql, userId);
  const buyerPremium = tier != null;
  const overtime =
    tier === "trio"
      ? " or (l.overtime_cents is not null and s.ends_on < current_date and coalesce(s.always_on, false) = false)"
      : "";
  const upcoming =
    tier === "trio"
      ? " or (s.starts_on > current_date and s.ends_on >= current_date and coalesce(s.always_on, false) = false)"
      : "";
  const rows = await sql.query<ListingRow>(
    listingSelect +
      ` where l.status = 'live' and ((s.always_on = true or (s.starts_on <= current_date and s.ends_on >= current_date))${upcoming}${overtime}) order by ((l.featured_until is not null and l.featured_until > now()) or (s.featured_until is not null and s.featured_until > now())) desc, l.created_at desc`,
  );
  let saved = new Set<string>();
  if (userId) {
    const savedRows = await sql<{ listing_id: string }>`select listing_id from saved_listings where user_id = ${userId}`;
    saved = new Set(savedRows.map((r) => r.listing_id));
  }
  const fromHood = await viewerNeighborhood(sql, userId);
  const salesRows = await sql.query<SaleMapRow>(
    `select s.id, s.seller_id, p.handle as seller_handle, s.name, s.kind, s.neighborhood,
            s.starts_on, s.ends_on, s.handoff_modes, s.handoff_spot_id, s.status,
            coalesce(s.channel, 'online') as channel, s.physical_location, s.hours_start, s.hours_end,
            s.online_start_dow, s.online_end_dow, s.live_on, s.live_start_dow, s.live_end_dow, s.live_open, s.live_close, s.always_on,
            (s.featured_until is not null and s.featured_until > now()) as featured,
            (select count(*)::int from listings l where l.sale_id = s.id and l.status = 'live') as item_count
     from sales s join profiles p on p.id = s.seller_id
     where s.status = 'live' and (s.always_on = true or s.ends_on >= current_date)
     order by (s.featured_until is not null and s.featured_until > now()) desc, s.starts_on, s.name`,
  );
  const spots = await sql<HandoffSpot>`
    select id, name, area, hint, kind from handoff_spots
    order by case when kind = 'partner' then 0 else 1 end, name
  `;
  return {
    listings: rows.map((r) =>
      withDistance(forViewer(mapListing(r, saved.has(r.id)), { mine: r.seller_id === userId, trio: tier === "trio" }), fromHood),
    ),
    sales: salesRows.map(mapSale),
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
    if (row.status === "stashed" && userId !== row.seller_id) return null;
    const buyerTier = await viewerTier(sql, userId);
    const buyerPremium = buyerTier != null;
    const ended = !row.always_on && String(row.ends_on).slice(0, 10) < new Date().toISOString().slice(0, 10);
    const upcoming = saleIsUpcoming(String(row.starts_on), Boolean(row.always_on));
    if (upcoming && userId !== row.seller_id && buyerTier !== "trio") return null;
    const overtimeOn = ended && row.overtime_cents != null;
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
        where o.listing_id = ${id} and o.buyer_id = ${userId} and o.phase = ${overtimeOn ? "overtime" : "sale"}
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
    let sellerOffers: Offer[] = [];
    if (userId && userId === row.seller_id) {
      const incoming = await sql<{
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
        where o.listing_id = ${id} and o.seller_id = ${userId}
        order by o.created_at desc
      `;
      sellerOffers = incoming.map((r) => ({
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
      }));
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
    const meetupNote = await meetupNoteForViewer(sql, {
      userId,
      sellerId: row.seller_id,
      saleId: row.sale_id,
      listingId: id,
      modes: row.handoff_modes,
    });
    let paidAddress: string | null = null;
    if (userId && userId !== row.seller_id) {
      const paid = await sql<{ handoff_type: string; spot_id: string | null; address: string | null }>`
        select o.handoff_type, s.handoff_spot_id as spot_id, hs.address
        from orders o
        join listings l on l.id = o.listing_id
        join sales s on s.id = l.sale_id
        left join handoff_spots hs on hs.id = s.handoff_spot_id
        where o.listing_id = ${id} and o.buyer_id = ${userId} and o.status <> ${"cancelled"}
        order by o.created_at desc
        limit 1
      `;
      const order = paid[0];
      if (order?.handoff_type === "person") paidAddress = meetupNote;
      else if (order?.handoff_type === "official" || order?.handoff_type === "porch") {
        paidAddress = order.address?.trim() || (order.spot_id ? SPOT_ADDRESS[order.spot_id] ?? null : null);
      } else if (order?.handoff_type === "public" && publicSpot) {
        const pub = await sql<{ address: string | null }>`select address from handoff_spots where id = ${publicSpot.id}`;
        paidAddress = pub[0]?.address?.trim() || SPOT_ADDRESS[publicSpot.id] || null;
      }
    }
    const bundleRows = await sql<{ id: string; title: string; price_cents: number }>`
      select l.id, l.title, l.price_cents
      from bundle_items b
      join listings l on l.id = b.listing_id
      where b.bundle_id = ${id}
      order by l.title
    `;
    const kindRow = await sql<{ bundle_kind: string | null }>`select bundle_kind from listings where id = ${id}`;
    const sellerTier = await viewerTier(sql, row.seller_id);
    return {
      listing: withDistance(
        forViewer(mapListing(row, saved), { mine: userId === row.seller_id, trio: buyerTier === "trio" }),
        await viewerNeighborhood(sql, userId),
      ),
      bundleItems: bundleRows.map((item) => ({ id: item.id, title: item.title, priceCents: Number(item.price_cents) })),
      bundleKind: kindRow[0]?.bundle_kind ?? null,
      myOffer,
      myOrder,
      sellerOffers,
      buyerPremium,
      buyerTier,
      sellerPremium: sellerTier != null,
      sellerTier,
      publicSpot,
      floorCents: userId === row.seller_id ? Number(row.floor_cents ?? row.price_cents) : null,
      meetupNote,
      paidAddress,
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
    const sales = await sql.query<SaleMapRow>(
      `select s.id, s.seller_id, p.handle as seller_handle, s.name, s.kind, s.neighborhood,
              s.starts_on, s.ends_on, s.handoff_modes, s.handoff_spot_id, s.status,
              coalesce(s.channel, 'online') as channel, s.physical_location, s.hours_start, s.hours_end,
            s.online_start_dow, s.online_end_dow, s.live_on, s.live_start_dow, s.live_end_dow, s.live_open, s.live_close, s.always_on,
              (s.featured_until is not null and s.featured_until > now()) as featured,
              (select count(*)::int from listings l where l.sale_id = s.id) as item_count
       from sales s join profiles p on p.id = s.seller_id where s.id = $1`,
      [id],
    );
    const sale = sales[0];
    if (!sale) return null;
    const rows = await sql.query<ListingRow>(
      listingSelect + " where l.sale_id = $1 and l.status not in ('bundled', 'bundle', 'abandoned', 'withdrawn', 'stashed') order by l.created_at desc",
      [id],
    );
    const userId = await optionalUserId();
    const tier = await viewerTier(sql, userId);
    const fromHood = await viewerNeighborhood(sql, userId);
    let saved = new Set<string>();
    if (userId) {
      const savedRows = await sql<{ listing_id: string }>`select listing_id from saved_listings where user_id = ${userId}`;
      saved = new Set(savedRows.map((r) => r.listing_id));
    }
    return {
      sale: mapSale(sale),
      listings: rows
        .map((r) =>
          withDistance(forViewer(mapListing(r, saved.has(r.id)), { mine: userId === sale.seller_id, trio: tier === "trio" }), fromHood),
        )
        .filter((l) => !l.upcoming || userId === sale.seller_id || tier === "trio"),
      meetupNote: userId === sale.seller_id ? await sellerMeetupNote(sql, sale.id) : null,
      buyerTier: tier,
    };
  });

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureSeed(sql);
    await releaseDuePayouts(sql);
    const me = await ensureProfile(sql, context.userId);
    const txs = await sql<{
      id: string;
      kind: string;
      amount_cents: number;
      note: string | null;
      created_at: string;
    }>`select id, kind, amount_cents, note, created_at from wallet_tx where user_id = ${context.userId} order by created_at desc limit 20`;
    const mySales = await sql.query<SaleMapRow>(
      `select s.id, s.seller_id, p.handle as seller_handle, s.name, s.kind, s.neighborhood,
              s.starts_on, s.ends_on, s.handoff_modes, s.handoff_spot_id, s.status,
              coalesce(s.channel, 'online') as channel, s.physical_location, s.hours_start, s.hours_end,
            s.online_start_dow, s.online_end_dow, s.live_on, s.live_start_dow, s.live_end_dow, s.live_open, s.live_close, s.always_on,
              (select count(*)::int from listings l where l.sale_id = s.id) as item_count
       from sales s join profiles p on p.id = s.seller_id
       where s.seller_id = $1 order by s.created_at desc`,
      [context.userId],
    );
    const savedTier = await viewerTier(sql, context.userId);
    const savedRows = await sql.query<ListingRow>(
      listingSelect +
        " join saved_listings sv on sv.listing_id = l.id where sv.user_id = $1 order by sv.created_at desc",
      [context.userId],
    );
    const pendingRates = await loadPendingRates(sql, context.userId);
    const desk = await sql<{ desk_spot_id: string | null }>`select desk_spot_id from profiles where id = ${context.userId}`;
    const inventoryRows = await sql<{
      id: string;
      title: string;
      price_cents: number;
      photo_url: string;
      status: string;
      sale_name: string;
      ends_on: string;
    }>`
      select l.id, l.title, l.price_cents, l.photo_url, l.status, s.name as sale_name, s.ends_on::text
      from listings l
      join sales s on s.id = l.sale_id
      where l.seller_id = ${context.userId}
        and coalesce(l.charity_split, false) = false
        and (
          l.status = ${"stashed"}
          or (l.status = ${"live"} and coalesce(s.always_on, false) = false and s.ends_on < current_date)
        )
      order by l.status desc, l.title
    `;
    const usedFree = await freeSaleDaysUsed(sql, context.userId);
    const receivedDowns = await sql<{
      rating_id: string;
      listing_title: string;
      status: string | null;
      created_at: string;
    }>`
      select r.id as rating_id, l.title as listing_title, c.status, r.created_at
      from ratings r
      join orders o on o.id = r.order_id
      join listings l on l.id = o.listing_id
      left join rating_challenges c on c.rating_id = r.id
      where r.subject_id = ${context.userId} and r.overall = ${"down"}
      order by r.created_at desc
      limit 20
    `;
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
      sales: mySales.map(mapSale),
      plusSaleDaysLeft: me.isPremium && saleDayAllowance(me.plusTier) != null ? Math.max(0, (saleDayAllowance(me.plusTier) ?? 0) - usedFree) : 0,
      saved: savedRows
        .map((r) =>
          withDistance(forViewer(mapListing(r, true), { mine: r.seller_id === context.userId, trio: savedTier === "trio" }), me.neighborhood),
        )
        .filter((l) => !l.upcoming || l.sellerId === context.userId || savedTier === "trio")
        .filter((l) => l.status === "live" || l.status === "held" || l.status === "sold"),
      pendingRates,
      isDesk: Boolean(desk[0]?.desk_spot_id),
      inventory: inventoryRows.map((row) => ({
        id: row.id,
        title: row.title,
        priceCents: Number(row.price_cents),
        photoUrl: row.photo_url,
        status: row.status === "stashed" ? ("stashed" as const) : ("unsold" as const),
        saleName: row.sale_name,
        saleEnded: String(row.ends_on).slice(0, 10) < new Date().toISOString().slice(0, 10),
      })),
      receivedDowns: receivedDowns.map(
        (r): ReceivedDown => ({
          ratingId: r.rating_id,
          listingTitle: r.listing_title,
          overall: "down",
          challengeStatus:
            r.status === "open" || r.status === "upheld" || r.status === "removed" ? r.status : null,
          createdAt: r.created_at,
        }),
      ),
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
          city: z.string().max(80).nullable().optional(),
          legalFirstName: z.string().max(60).nullable().optional(),
          legalLastName: z.string().max(60).nullable().optional(),
          phone: z.string().max(24).nullable().optional(),
          handle: z.string().min(2).max(40).optional(),
        })
        .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const neighborhood = data.neighborhood?.trim() || null;
    if (data.neighborhood !== undefined && neighborhood && !NEIGHBORHOODS.includes(neighborhood as (typeof NEIGHBORHOODS)[number])) {
      throw new Error("Pick a neighborhood from the list.");
    }
    const city = data.city?.trim() || null;
    if (data.city !== undefined && city && !CITIES.includes(city as (typeof CITIES)[number])) {
      throw new Error("Pick a city from the list.");
    }
    if (neighborhood && city && cityOf(neighborhood) !== city) {
      throw new Error("That neighborhood is not in the city you picked.");
    }
    const first = data.legalFirstName?.trim() || null;
    const last = data.legalLastName?.trim() || null;
    if (data.legalFirstName !== undefined && first && first.length < 1) throw new Error("Add a first name.");
    if (data.legalLastName !== undefined && last && last.length < 1) throw new Error("Add a last name.");
    const phone = data.phone?.trim() || null;
    if (data.phone !== undefined && phone && phone.replace(/\D/g, "").length < 10) {
      throw new Error("Use a phone number with at least 10 digits.");
    }
    const zip = data.zip?.trim() || null;
    if (data.zip !== undefined && zip && !/^\d{5}(-\d{4})?$/.test(zip)) {
      throw new Error("Zip should be 5 digits.");
    }
    let handle: string | undefined;
    if (data.handle !== undefined) {
      try {
        handle = normalizeHandle(data.handle);
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : "That handle won’t work.");
      }
      const taken = await sql<{ id: string }>`
        select id from profiles where handle = ${handle} and id <> ${context.userId} limit 1
      `;
      if (taken[0]) throw new Error("That handle is taken. Try another.");
    }
    await sql`
      update profiles set
        neighborhood = case when ${data.neighborhood !== undefined} then ${neighborhood} else neighborhood end,
        zip = case when ${data.zip !== undefined} then ${zip} else zip end,
        city = case when ${data.city !== undefined} then ${city} else city end,
        legal_first_name = case when ${data.legalFirstName !== undefined} then ${first} else legal_first_name end,
        legal_last_name = case when ${data.legalLastName !== undefined} then ${last} else legal_last_name end,
        phone = case when ${data.phone !== undefined} then ${phone} else phone end,
        handle = coalesce(${handle ?? null}, handle)
      where id = ${context.userId}
    `;
    return ensureProfile(sql, context.userId);
  });

export const setHandle = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ handle: z.string().min(2).max(40) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    let handle: string;
    try {
      handle = normalizeHandle(data.handle);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "That handle won’t work.");
    }
    const taken = await sql<{ id: string }>`
      select id from profiles where handle = ${handle} and id <> ${context.userId} limit 1
    `;
    if (taken[0]) throw new Error("That handle is taken. Try another.");
    await sql`update profiles set handle = ${handle} where id = ${context.userId}`;
    return { handle };
  });

export const togglePremium = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        plan: z.enum(["month", "year", "trio_month", "trio_year"]).optional(),
        cancel: z.boolean().optional(),
      })
      .optional()
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfile(sql, context.userId);
    if (data?.cancel || (me.isPremium && !data?.plan)) {
      await sql`
        update profiles set is_premium = false, plus_plan = null, plus_tier = null, plus_until = null
        where id = ${context.userId}
      `;
      return { isPremium: false, plusPlan: null as "month" | "year" | null, plusTier: null as "plus" | "trio" | null };
    }
    const plan = data?.plan ?? "month";
    const yearly = plan === "year" || plan === "trio_year";
    const tier = plan === "trio_month" || plan === "trio_year" ? "trio" : "plus";
    const feeId = plan === "trio_year" ? "trio_year" : plan === "trio_month" ? "trio_month" : plan === "year" ? "plus_year" : "premium_switch";
    const fees = await loadFees(sql);
    const switchFee = fees.find((row) => row.id === feeId);
    const fallback = tier === "trio" ? (yearly ? 29999 : 2999) : yearly ? 9999 : 999;
    const cost = switchFee?.enabled ? switchFee.amountCents : fallback;
    if (me.walletCents < cost) {
      throw new Error(`Add more test credits on You to start ${tier === "trio" ? "Rummlee +++" : "Rummlee Plus"}. See Fees.`);
    }
    await debitWallet(sql, context.userId, cost);
    const days = yearly ? 365 : 30;
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const plusPlan = yearly ? "year" : "month";
    await sql`
      update profiles
      set is_premium = true, plus_plan = ${plusPlan}, plus_tier = ${tier}, plus_until = ${until}::timestamptz
      where id = ${context.userId}
    `;
    const label = tier === "trio" ? "Rummlee +++" : "Rummlee Plus";
    await sql`
      insert into wallet_tx (id, user_id, kind, amount_cents, note)
      values (
        ${crypto.randomUUID()}, ${context.userId}, ${"premium"}, ${-cost},
        ${yearly ? `${label} — 1 year (test, billed on its own)` : `${label} — 1 month (test, billed on its own)`}
      )
    `;
    if (yearly) {
      const earned = Math.round(cost / 12);
      await writeLedger(sql, { userId: context.userId, account: "plus_monthly", amountCents: earned, note: tier === "trio" ? "+++ year, this month" : "Plus year, this month" });
      await writeLedger(sql, { userId: context.userId, account: "plus_deferred", amountCents: cost - earned, note: tier === "trio" ? "+++ year, still unearned" : "Plus year, still unearned" });
    } else {
      await writeLedger(sql, { userId: context.userId, account: "plus_monthly", amountCents: cost, note: tier === "trio" ? "+++ month" : "Plus month" });
    }
    const { syncReferralBooks } = await import("./referrals");
    await syncReferralBooks(sql);
    return { isPremium: true, plusPlan, plusTier: tier };
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
    const room = await sql<{ wallet_cents: number }>`select wallet_cents from profiles where id = ${context.userId}`;
    const have = Number(room[0]?.wallet_cents ?? 0);
    const cap = 50000;
    if (have >= cap) throw new Error("Test wallet is full. Beta credits stop at $500.");
    const add = Math.min(cents, cap - have);
    await sql`update profiles set wallet_cents = wallet_cents + ${add} where id = ${context.userId} and wallet_cents < ${cap}`;
    await sql`
      insert into wallet_tx (id, user_id, kind, amount_cents, note)
      values (${crypto.randomUUID()}, ${context.userId}, ${"topup"}, ${add}, ${"Test credits (beta — not real money)"})
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
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  channel: z.enum(["online", "physical", "both"]),
  physicalLocation: z.string().max(120).optional(),
  hoursStart: z.string().max(8).optional(),
  hoursEnd: z.string().max(8).optional(),
  handoffModes: z.array(z.enum(["official", "public", "person", "porch"])).min(1),
  handoffSpotId: z.string().nullable().optional(),
  onlineStartDow: z.number().int().min(0).max(6).optional(),
  onlineEndDow: z.number().int().min(0).max(6).optional(),
  liveOn: z.boolean().optional(),
  liveStartDow: z.number().int().min(0).max(6).optional(),
  liveEndDow: z.number().int().min(0).max(6).optional(),
  liveOpen: z.string().max(8).optional(),
  liveClose: z.string().max(8).optional(),
  meetupNote: z.string().max(240).optional(),
});

export const createSale = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => saleInput.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfile(sql, context.userId);
    if (!me.profileComplete) throw new Error("Finish your account first. Your legal name and phone stay private.");
    const days = countSaleDays(data.startsOn, data.endsOn);
    if (days < 1) throw new Error("End date has to be on or after the start.");
    if (days > MAX_SALE_DAYS) throw new Error(`A sale can run at most ${MAX_SALE_DAYS} days.`);
    const live = Boolean(data.liveOn);
    const physical = !live && (data.channel === "physical" || data.channel === "both");
    const location = data.physicalLocation?.trim() ?? "";
    if (physical && location.length < 4) throw new Error("A public handoff needs a place name, not a home address.");
    if (physical && (!data.hoursStart || !data.hoursEnd)) throw new Error("In-person hours need an open and a close.");
    if (live && (!data.liveOpen || !data.liveClose)) throw new Error("Live hours need an open and a close.");
    const note = data.meetupNote?.trim() ?? "";
    const fees = await loadFees(sql);
    const dayFee = feeById(fees, "sale_day");
    const dayFeeCents = dayFee?.enabled && dayFee.unit === "cents" ? dayFee.amountCents : 0;
    const usedFree = await freeSaleDaysUsed(sql, context.userId);
    const allowance = saleDayAllowance(me.plusTier);
    const quote = quoteSaleDays({
      dayFeeCents,
      days,
      plus: me.isPremium,
      freeUsed: allowance == null ? 0 : usedFree,
      freePerMonth: allowance,
    });
    if (quote.chargeCents > 0 && me.walletCents < quote.chargeCents) {
      throw new Error(
        TEST_MODE
          ? `Not enough test credits for ${quote.paidDays} sale day${quote.paidDays === 1 ? "" : "s"}. See Fees.`
          : `Not enough wallet for ${quote.paidDays} sale day${quote.paidDays === 1 ? "" : "s"}. See Fees.`,
      );
    }
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
    const channel = live ? "both" : data.channel === "physical" ? "physical" : "online";
    if (quote.chargeCents > 0) await debitWallet(sql, context.userId, quote.chargeCents);
    await sql`
      insert into sales (
        id, seller_id, name, kind, neighborhood, starts_on, ends_on, handoff_modes, handoff_spot_id, status,
        channel, physical_location, hours_start, hours_end, sale_fee_cents, sale_free_days,
        online_start_dow, online_end_dow, live_on, live_start_dow, live_end_dow, live_open, live_close, meetup_note
      )
      values (
        ${id}, ${context.userId}, ${data.name}, ${data.kind}, ${data.neighborhood},
        ${data.startsOn}::date, ${data.endsOn}::date, ${modes.join(",")},
        ${spotId}, ${"live"},
        ${channel}, ${physical ? location : null},
        ${live ? data.liveOpen : physical ? data.hoursStart : null},
        ${live ? data.liveClose : physical ? data.hoursEnd : null},
        ${quote.chargeCents}, ${quote.freeDays},
        ${data.onlineStartDow ?? 2}, ${data.onlineEndDow ?? 4}, ${live},
        ${live ? (data.liveStartDow ?? 5) : null}, ${live ? (data.liveEndDow ?? 0) : null},
        ${live ? data.liveOpen : null}, ${live ? data.liveClose : null},
        ${note || null}
      )
    `;
    let remainingFree = quote.freeDays;
    for (let i = 0; i < days; i += 1) {
      const day = new Date(`${data.startsOn}T00:00:00Z`);
      day.setUTCDate(day.getUTCDate() + i);
      const iso = day.toISOString().slice(0, 10);
      const free = remainingFree > 0;
      if (free) remainingFree -= 1;
      await sql`
        insert into sale_days (sale_id, day, charged_cents)
        values (${id}, ${iso}::date, ${free ? 0 : dayFeeCents})
      `;
    }
    if (quote.chargeCents > 0) {
      await sql`
        insert into wallet_tx (id, user_id, kind, amount_cents, ref_id, note)
        values (
          ${crypto.randomUUID()}, ${context.userId}, ${"sale_day"}, ${-quote.chargeCents}, ${id},
          ${
            TEST_MODE
              ? `Test sale days: ${days} (${quote.freeDays} Plus free, ${quote.paidDays} paid)`
              : `Sale days: ${days} (${quote.freeDays} Plus free, ${quote.paidDays} paid)`
          }
        )
      `;
    }
    if (!me.neighborhood) {
      await sql`update profiles set neighborhood = ${data.neighborhood} where id = ${context.userId}`;
    }
    await notifyNewSale(sql, id);
    return { id, chargeCents: quote.chargeCents, freeDays: quote.freeDays, paidDays: quote.paidDays, days };
  });

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function addIso(iso: string, days: number) {
  const day = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

function flatFeeCents(fees: FeeRow[], id: string) {
  const row = feeById(fees, id);
  if (!row?.enabled || row.unit !== "cents") return 0;
  return row.amountCents;
}

function payNote(fromWallet: number, fromPayout: number) {
  const wallet = fromWallet > 0 ? `$${(fromWallet / 100).toFixed(2)} from ${TEST_MODE ? "test credits" : "the wallet"}` : "";
  const payout = fromPayout > 0 ? `$${(fromPayout / 100).toFixed(2)} from the next payout` : "";
  return [wallet, payout].filter(Boolean).join(" and ") || "no charge";
}

export const extendSale = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        saleId: z.string().min(2),
        extraDays: z.number().int().min(1).max(7),
        feature: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureSeed(sql);
    const me = await ensureProfile(sql, context.userId);
    const rows = await sql<{
      id: string;
      starts_on: string;
      ends_on: string;
      always_on: boolean | null;
      kind: string;
      featured_until: string | null;
    }>`
      select id, starts_on::text, ends_on::text, always_on, kind, featured_until
      from sales where id = ${data.saleId} and seller_id = ${context.userId}
    `;
    const sale = rows[0];
    if (!sale) throw new Error("Sale not found.");
    if (sale.always_on || sale.kind === "house") throw new Error("This sale stays up. It doesn’t need an extension.");
    const start = String(sale.starts_on).slice(0, 10);
    const end = String(sale.ends_on).slice(0, 10);
    const tomorrow = addIso(isoToday(), 1);
    if (end > tomorrow) throw new Error("This sale isn’t closing yet.");
    const base = end < isoToday() ? isoToday() : end;
    const nextEnd = addIso(base, data.extraDays);
    if (countSaleDays(start, nextEnd) > MAX_SALE_DAYS) {
      const room = MAX_SALE_DAYS - countSaleDays(start, end < isoToday() ? isoToday() : end);
      throw new Error(room > 0 ? `Only ${room} more day${room === 1 ? "" : "s"} fit. A sale runs at most ${MAX_SALE_DAYS} days.` : `This sale is already ${MAX_SALE_DAYS} days. Start another one.`);
    }
    const fees = await loadFees(sql);
    const dayFee = feeById(fees, "sale_day");
    const dayFeeCents = dayFee?.enabled && dayFee.unit === "cents" ? dayFee.amountCents : 0;
    const allowance = saleDayAllowance(me.plusTier);
    const quote = quoteSaleDays({
      dayFeeCents,
      days: data.extraDays,
      plus: me.isPremium,
      freeUsed: allowance == null ? 0 : await freeSaleDaysUsed(sql, context.userId),
      freePerMonth: allowance,
    });
    const featureCents = data.feature ? flatFeeCents(fees, "feature_sale") : 0;
    const charge = quote.chargeCents + featureCents;
    const paid = await chargeSeller(
      sql,
      context.userId,
      charge,
      `${data.extraDays} more sale day${data.extraDays === 1 ? "" : "s"}${data.feature ? ", and feature the sale" : ""}.${TEST_MODE ? " Test credits, not real money." : ""}`,
      sale.id,
    );
    await sql`update sales set ends_on = ${nextEnd}::date, sale_free_days = coalesce(sale_free_days, 0) + ${quote.freeDays} where id = ${sale.id}`;
    await sql`update listings set overtime_cents = null where sale_id = ${sale.id}`;
    for (let i = 1; i <= data.extraDays; i += 1) {
      const iso = addIso(base, i);
      await sql`
        insert into sale_days (sale_id, day, charged_cents)
        values (${sale.id}, ${iso}::date, ${i <= quote.freeDays ? 0 : dayFeeCents})
        on conflict (sale_id, day) do nothing
      `;
    }
    if (data.feature || sale.featured_until) {
      await sql`update sales set featured_until = ${nextEnd}::date + interval '1 day' where id = ${sale.id}`;
    }
    return { endsOn: nextEnd, chargeCents: charge, ...paid, paidNote: payNote(paid.fromWallet, paid.fromPayout) };
  });

export const featureSale = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ saleId: z.string().min(2) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureSeed(sql);
    await ensureProfile(sql, context.userId);
    const rows = await sql<{ id: string; ends_on: string; always_on: boolean | null; featured_until: string | null }>`
      select id, ends_on::text, always_on, featured_until from sales
      where id = ${data.saleId} and seller_id = ${context.userId}
    `;
    const sale = rows[0];
    if (!sale) throw new Error("Sale not found.");
    if (sale.featured_until && new Date(sale.featured_until).getTime() > Date.now()) throw new Error("This sale is already featured.");
    const cents = flatFeeCents(await loadFees(sql), "feature_sale");
    const paid = await chargeSeller(sql, context.userId, cents, TEST_MODE ? "Feature this sale. Test credits, not real money." : "Feature this sale.", sale.id);
    const until = sale.always_on ? addIso(isoToday(), 30) : String(sale.ends_on).slice(0, 10);
    await sql`update sales set featured_until = ${until}::date + interval '1 day' where id = ${sale.id}`;
    return { chargeCents: cents, ...paid, paidNote: payNote(paid.fromWallet, paid.fromPayout) };
  });

export const featureListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ listingId: z.string().min(2) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureSeed(sql);
    await ensureProfile(sql, context.userId);
    const rows = await sql<{ id: string; ends_on: string; always_on: boolean | null; featured_until: string | null }>`
      select l.id, s.ends_on::text, s.always_on, l.featured_until
      from listings l join sales s on s.id = l.sale_id
      where l.id = ${data.listingId} and l.seller_id = ${context.userId} and l.status = ${"live"}
    `;
    const item = rows[0];
    if (!item) throw new Error("Listing not found.");
    if (item.featured_until && new Date(item.featured_until).getTime() > Date.now()) throw new Error("This item is already featured.");
    const cents = flatFeeCents(await loadFees(sql), "feature_item");
    const paid = await chargeSeller(sql, context.userId, cents, TEST_MODE ? "Feature this item. Test credits, not real money." : "Feature this item.", item.id);
    const until = item.always_on ? addIso(isoToday(), 30) : String(item.ends_on).slice(0, 10);
    await sql`update listings set featured_until = ${until}::date + interval '1 day' where id = ${item.id}`;
    return { chargeCents: cents, ...paid, paidNote: payNote(paid.fromWallet, paid.fromPayout) };
  });

export const markSoldOutside = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ listingId: z.string().min(2) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string; seller_id: string; status: string }>`
      select id, seller_id, status from listings where id = ${data.listingId}
    `;
    const item = rows[0];
    if (!item || item.seller_id !== context.userId) throw new Error("That’s not your listing.");
    if (item.status === "held") {
      throw new Error("This one is already held on Rummlee. It can’t be marked sold outside.");
    }
    if (item.status !== "live") throw new Error("This listing is already ended.");
    await sql`update listings set status = ${"outside"} where id = ${item.id} and status = ${"live"}`;
    await sql`
      update offers
      set status = ${"declined"}, declined_by = ${"outside"}, updated_at = now()
      where listing_id = ${item.id} and status in (${"pending"}, ${"countered"}, ${"accepted"})
    `;
    return { ok: true as const };
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
  sizeLabel: z.string().max(40).optional(),
  pack: z.enum(["box", "as_is"]),
  weightLbs: z.number().int().min(1).max(2000).nullable().optional(),
  photoUrl: z.string().min(4),
  handoffModes: z.array(z.enum(["official", "public", "person", "porch"])).min(1),
  researchId: z.string().min(2).optional(),
});

export const fillFromPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ photoUrl: z.string().min(12).max(1_500_000) }).parse(data))
  .handler(async ({ context, data }) => {
    if (!PHOTO_FILL_ENABLED) throw new Error("Photo fill is off during beta.");
    const sql = await getSql();
    const me = await ensureProfile(sql, context.userId);
    const suggestion = await suggestFromPhoto(data.photoUrl);
    const fees = await loadFees(sql);
    const row = feeById(fees, "photo_fill");
    const charge = !row?.enabled ? 0 : row.unit === "cents" ? row.amountCents : 0;
    if (charge > 0) await debitWallet(sql, me.id, charge);
    if (charge > 0) {
      await sql`
        insert into wallet_tx (id, user_id, kind, amount_cents, note)
        values (${crypto.randomUUID()}, ${me.id}, ${"photo"}, ${-charge}, ${"Photo fill. Price and weight stay yours."})
      `;
    }
    return { ...suggestion, chargedCents: charge };
  });

export const addListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => listingInput.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfile(sql, context.userId);
    if (!me.profileComplete) throw new Error("Finish your account first. Your legal name and phone stay private.");
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
      await debitWallet(sql, context.userId, listFee.amountCents);
      await sql`
        insert into wallet_tx (id, user_id, kind, amount_cents, note)
        values (${crypto.randomUUID()}, ${context.userId}, ${"list"}, ${-listFee.amountCents}, ${"List an item"})
      `;
    }
    const sale = await sql<{ id: string; seller_id: string; neighborhood: string }>`
      select id, seller_id, neighborhood from sales where id = ${data.saleId} and seller_id = ${context.userId}
    `;
    if (!sale[0]) throw new Error("Sale not found.");
    if (me.plusTier !== "trio") {
      const have = await sql<{ n: number }>`
        select count(*)::int as n from listings where sale_id = ${data.saleId} and status <> ${"withdrawn"}
      `;
      if (Number(have[0]?.n ?? 0) >= SALE_ITEM_CAP) {
        throw new Error(`A sale holds ${SALE_ITEM_CAP} items. Rummlee +++ has no item cap.`);
      }
    }
    const id = crypto.randomUUID();
    const modes = fitsOfficialCounter({ pack: data.pack, weightLbs: data.weightLbs, haul: data.haul })
      ? splitModes(data.handoffModes.join(","))
      : (["person"] as const);
    await sql`
      insert into listings (
        id, sale_id, seller_id, title, description, price_cents, buy_now_cents, original_cents, floor_cents,
        category, condition, haul, size_label, pack, weight_lbs, neighborhood, handoff_modes, photo_url, status
      ) values (
        ${id}, ${data.saleId}, ${context.userId}, ${data.title}, ${data.description ?? ""},
        ${data.priceCents}, ${data.buyNowCents ?? data.priceCents}, ${null}, ${data.floorCents},
        ${data.category}, ${data.condition}, ${data.haul}, ${data.sizeLabel?.trim() || null}, ${data.pack},
        ${data.weightLbs ?? null}, ${sale[0].neighborhood},
        ${modes.join(",")}, ${await storePhoto(safePhoto(data.photoUrl), `listings/${id}`)}, ${"live"}
      )
    `;
    if (data.researchId) {
      await sql`
        update research_requests
        set listing_id = ${id}
        where id = ${data.researchId}
          and seller_id = ${context.userId}
          and status = ${"accepted"}
          and listing_id is null
      `;
    }
    await notifyNewListing(sql, id);
    return { id };
  });

export const setOvertime = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        listingId: z.string(),
        cents: z.number().int().min(100).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureSeed(sql);
    const rows = await sql<{
      id: string;
      seller_id: string;
      status: string;
      price_cents: number;
      charity_split: boolean;
      ends_on: string;
      always_on: boolean | null;
    }>`
      select l.id, l.seller_id, l.status, l.price_cents, l.charity_split, s.ends_on::text, s.always_on
      from listings l join sales s on s.id = l.sale_id
      where l.id = ${data.listingId}
    `;
    const item = rows[0];
    if (!item || item.seller_id !== context.userId) throw new Error("That isn’t your item.");
    if (item.always_on || item.charity_split) throw new Error("Shelf items don’t go to overtime.");
    if (item.status !== "live") throw new Error("Only an unsold item can go to overtime.");
    if (String(item.ends_on).slice(0, 10) >= new Date().toISOString().slice(0, 10)) {
      throw new Error("Overtime starts after the sale ends.");
    }
    if (data.cents == null) {
      await sql`update listings set overtime_cents = null where id = ${item.id}`;
      return { overtimeCents: null };
    }
    const fees = await loadFees(sql);
    const min = minAskingCents(fees);
    if (data.cents < min) throw new Error(`Get rid of it has to be at least $${(min / 100).toFixed(min % 100 === 0 ? 0 : 2)}.`);
    if (data.cents > Number(item.price_cents)) throw new Error("Get rid of it can’t be higher than asking.");
    await sql`update listings set overtime_cents = ${data.cents} where id = ${item.id}`;
    return { overtimeCents: data.cents };
  });

async function closeOpenOffers(sql: Awaited<ReturnType<typeof getSql>>, listingId: string) {
  await sql`
    update offers
    set status = ${"declined"}, declined_by = ${"seller"}, updated_at = now()
    where listing_id = ${listingId} and status in (${"pending"}, ${"countered"})
  `;
}

export const stashListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ listingId: z.string().min(2) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string; seller_id: string; status: string; charity_split: boolean }>`
      select id, seller_id, status, charity_split from listings where id = ${data.listingId}
    `;
    const item = rows[0];
    if (!item || item.seller_id !== context.userId) throw new Error("That’s not your item.");
    if (item.charity_split) throw new Error("A shelf item can’t be stashed.");
    if (item.status === "held") throw new Error("This one is held. Finish the handoff first.");
    if (item.status !== "live") throw new Error("Only an unsold item can be stashed.");
    const held = await sql<{ id: string }>`select id from orders where listing_id = ${item.id} and status = ${"escrow"} limit 1`;
    if (held[0]) throw new Error("This one is held. Finish the handoff first.");
    await closeOpenOffers(sql, item.id);
    await sql`update listings set status = ${"stashed"}, overtime_cents = null where id = ${item.id}`;
    return { ok: true as const };
  });

export const removeListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ listingId: z.string().min(2) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string; seller_id: string; status: string; charity_split: boolean }>`
      select id, seller_id, status, charity_split from listings where id = ${data.listingId}
    `;
    const item = rows[0];
    if (!item || item.seller_id !== context.userId) throw new Error("That’s not your item.");
    if (item.charity_split) throw new Error("A shelf item can’t be removed this way.");
    if (item.status === "held") throw new Error("This one is held. Finish the handoff first.");
    if (item.status !== "live" && item.status !== "stashed") throw new Error("This item isn’t in your inventory.");
    const held = await sql<{ id: string }>`select id from orders where listing_id = ${item.id} and status = ${"escrow"} limit 1`;
    if (held[0]) throw new Error("This one is held. Finish the handoff first.");
    await closeOpenOffers(sql, item.id);
    await sql`update listings set status = ${"withdrawn"}, overtime_cents = null where id = ${item.id}`;
    return { ok: true as const };
  });

export const restockListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ listingId: z.string().min(2), saleId: z.string().min(2) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfile(sql, context.userId);
    const rows = await sql<{ id: string; status: string }>`
      select id, status from listings where id = ${data.listingId} and seller_id = ${context.userId}
    `;
    const item = rows[0];
    if (!item || item.status !== "stashed") throw new Error("Stash it first, then put it on a sale.");
    const sales = await sql<{ id: string; neighborhood: string; ends_on: string; always_on: boolean | null }>`
      select id, neighborhood, ends_on::text, always_on from sales
      where id = ${data.saleId} and seller_id = ${context.userId} and status = ${"live"}
    `;
    const sale = sales[0];
    if (!sale) throw new Error("Sale not found.");
    if (!sale.always_on && String(sale.ends_on).slice(0, 10) < new Date().toISOString().slice(0, 10)) {
      throw new Error("That sale has ended. Pick one that’s still on, or start a new sale.");
    }
    if (me.plusTier !== "trio") {
      const have = await sql<{ n: number }>`
        select count(*)::int as n from listings where sale_id = ${sale.id} and status not in (${"withdrawn"}, ${"stashed"})
      `;
      if (Number(have[0]?.n ?? 0) >= SALE_ITEM_CAP) {
        throw new Error(`A sale holds ${SALE_ITEM_CAP} items. Rummlee +++ has no item cap.`);
      }
    }
    await sql`
      update listings
      set status = ${"live"}, sale_id = ${sale.id}, neighborhood = ${sale.neighborhood}, overtime_cents = null
      where id = ${item.id}
    `;
    return { ok: true as const };
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
    const offerer = await ensureProfile(sql, context.userId);
    if (!offerer.profileComplete) throw new Error("Finish your account first. Your legal name and phone stay private.");
    const listingId = resolveListingId(data.listingId);
    const listing = await sql<{
      id: string;
      seller_id: string;
      price_cents: number;
      floor_cents: number | null;
      status: string;
      title: string;
      charity_split: boolean;
      overtime_cents: number | null;
      ends_on: string;
      starts_on: string;
      always_on: boolean | null;
    }>`
      select l.id, l.seller_id, l.price_cents, l.floor_cents, l.status, l.title, l.charity_split,
             l.overtime_cents, s.ends_on::text, s.starts_on::text, s.always_on
      from listings l join sales s on s.id = l.sale_id
      where l.id = ${listingId}
    `;
    const item = listing[0];
    if (!item || item.status !== "live") throw new Error("This item isn’t available.");
    if (item.charity_split) throw new Error("This is a Rummlee resale. Pay asking.");
    if (item.seller_id === context.userId) throw new Error("You can’t offer on your own listing.");
    if (saleIsUpcoming(String(item.starts_on), Boolean(item.always_on))) {
      throw new Error("This sale hasn’t started. The price isn’t up yet.");
    }
    const ended = !item.always_on && String(item.ends_on).slice(0, 10) < new Date().toISOString().slice(0, 10);
    const overtime = ended && item.overtime_cents != null;
    if (ended && !overtime) throw new Error("This sale has ended.");
    if (overtime && offerer.plusTier !== "trio") throw new Error("Overtime offers are for +++.");
    const open = await sql<{ id: string }>`
      select id from offers
      where listing_id = ${listingId} and buyer_id = ${context.userId} and status in (${"pending"}, ${"countered"})
      limit 1
    `;
    if (open[0]) throw new Error("Finish the offer you already have.");
    if (overtime) {
      const used = await sql<{ id: string }>`
        select id from offers
        where listing_id = ${listingId} and buyer_id = ${context.userId} and phase = ${"overtime"}
        limit 1
      `;
      if (used[0]) throw new Error("You already used your overtime offer. Pay the get-rid-of-it price to hold it.");
    } else {
      const existing = await sql<{ id: string }>`
        select id from offers where listing_id = ${listingId} and buyer_id = ${context.userId} and phase = ${"sale"}
        order by created_at desc limit 1
      `;
      if (existing[0]) throw new Error("You already used your one offer on this item. You can still pay asking.");
      const usedUp = await sql<{ listing_id: string }>`
        select listing_id from offer_uses where listing_id = ${listingId} and buyer_id = ${context.userId}
      `;
      if (usedUp[0]) throw new Error("You already used your one offer on this item. You can still pay asking.");
    }
    const ask = overtime ? Number(item.overtime_cents) : Number(item.price_cents);
    const floor = overtime ? 0 : Number(item.floor_cents ?? item.price_cents);
    if (data.amountCents >= ask) {
      throw new Error(overtime ? "That’s the get-rid-of-it price or more. Pay that to hold it." : "That’s asking or more. Pay asking to hold it.");
    }
    const id = crypto.randomUUID();
    let status: Offer["status"] = "pending";
    let declinedBy: "floor" | null = null;
    if (!overtime && data.amountCents < floor) {
      status = "declined";
      declinedBy = "floor";
    } else if (isSeedUser(item.seller_id)) {
      status = "accepted";
    }
    await sql`
      insert into offers (id, listing_id, buyer_id, seller_id, amount_cents, counter_cents, status, declined_by, note, phase)
      values (${id}, ${listingId}, ${context.userId}, ${item.seller_id}, ${data.amountCents}, ${null}, ${status}, ${declinedBy}, ${data.note ?? null}, ${overtime ? "overtime" : "sale"})
    `;
    if (status === "accepted") {
      await sql`
        insert into messages (id, listing_id, from_id, to_id, body)
        values (
          ${crypto.randomUUID()}, ${listingId}, ${item.seller_id}, ${context.userId},
          ${"Yes. Pay to hold it, then we’ll confirm at the handoff location."}
        )
      `;
    }
    if (status === "declined") await useBundleOffers(sql, listingId, context.userId);
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
      amount_cents: number;
      phase: string;
      overtime_cents: number | null;
    }>`
      select o.id, o.listing_id, o.buyer_id, o.seller_id, o.status, o.amount_cents, o.phase,
             l.floor_cents, l.price_cents, l.overtime_cents
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
      const overtime = offer.phase === "overtime" ? Number(offer.overtime_cents ?? 0) : 0;
      const floor = overtime > 0 ? Number(offer.amount_cents) + 1 : Number(offer.floor_cents ?? offer.price_cents);
      const ask = overtime > 0 ? overtime : Number(offer.price_cents);
      if (data.counterCents < floor || data.counterCents > ask) {
        throw new Error(
          overtime > 0
            ? "Counteroffer has to sit between their offer and your get-rid-of-it price."
            : "Counteroffer has to sit between your lowest and asking.",
        );
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
      await useBundleOffers(sql, offer.listing_id, offer.buyer_id);
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
    const listingId = resolveListingId(data.listingId);
    const listing = await sql<{ id: string; seller_id: string; charity_split: boolean }>`
      select id, seller_id, charity_split from listings where id = ${listingId}
    `;
    const item = listing[0];
    if (!item) throw new Error("Listing not found.");
    if (item.charity_split) throw new Error("Rummlee shelf items don’t take questions. Pay asking if you want it.");
    const toId = item.seller_id === context.userId
      ? (
          await sql<{ buyer_id: string }>`
            select buyer_id from offers where listing_id = ${listingId} and seller_id = ${context.userId}
            order by created_at desc limit 1
          `
        )[0]?.buyer_id
      : item.seller_id;
    if (!toId) throw new Error("No one to message yet.");
    if (toId === context.userId) throw new Error("That’s you.");
    await sql`
      insert into messages (id, listing_id, from_id, to_id, body)
      values (${crypto.randomUUID()}, ${listingId}, ${context.userId}, ${toId}, ${data.body.trim()})
    `;
    if (isSeedUser(toId)) {
      await sql`
        insert into messages (id, listing_id, from_id, to_id, body)
        values (
          ${crypto.randomUUID()}, ${listingId}, ${toId}, ${context.userId},
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
        payAsking: z.boolean().optional(),
        handoffType: z.enum(["official", "person", "porch"]),
        meet: z.enum(["partner", "public", "person"]).optional(),
        handoffSpotId: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfile(sql, context.userId);
    if (!me.profileComplete) throw new Error("Finish your account first. Your legal name and phone stay private.");
    const listingId = resolveListingId(data.listingId);
    const listing = await sql<{
      id: string;
      seller_id: string;
      title: string;
      status: string;
      price_cents: number;
      handoff_modes: string;
      neighborhood: string;
      handoff_spot_id: string | null;
      bundle_kind: string | null;
      bundle_for: string | null;
      charity_split: boolean;
      overtime_cents: number | null;
      ends_on: string;
      starts_on: string;
      always_on: boolean | null;
    }>`
      select l.id, l.seller_id, l.title, l.status, l.price_cents, l.handoff_modes, l.neighborhood,
             s.handoff_spot_id, l.bundle_kind, l.bundle_for, l.charity_split,
             l.overtime_cents, s.ends_on::text, s.starts_on::text, s.always_on
      from listings l
      join sales s on s.id = l.sale_id
      where l.id = ${listingId}
    `;
    const item = listing[0];
    if (!item) throw new Error("This item isn’t available.");
    if (item.status === "held") {
      const openHold = await sql<{ id: string }>`
        select id from orders where listing_id = ${item.id} and status = ${"escrow"} limit 1
      `;
      if (!openHold[0]) {
        await releaseBundleChildren(sql, item.id);
        const back = item.bundle_kind === "buyer" ? "bundle" : "live";
        await sql`update listings set status = ${back} where id = ${item.id} and status = ${"held"}`;
        item.status = back;
      }
    }
    if (item.status === "bundle" && item.bundle_for && item.bundle_for !== context.userId) {
      throw new Error("This bundle isn’t yours to pay.");
    }
    if (item.status !== "live" && item.status !== "bundle") throw new Error("This item isn’t available.");
    if (item.seller_id === context.userId) throw new Error("That’s your listing.");
    if (saleIsUpcoming(String(item.starts_on), Boolean(item.always_on))) {
      throw new Error("This sale hasn’t started. The price isn’t up yet.");
    }
    if (saleIsUpcoming(String(item.starts_on), Boolean(item.always_on))) {
      throw new Error("This sale hasn’t started. The price isn’t up yet.");
    }
    const ended = !item.always_on && String(item.ends_on).slice(0, 10) < new Date().toISOString().slice(0, 10);
    const clearance = ended ? Number(item.overtime_cents ?? 0) : 0;
    if (ended && clearance <= 0) throw new Error("This sale has ended.");
    if (ended && me.plusTier !== "trio") throw new Error("Overtime is for +++.");
    const offerRows = await sql<{ status: string; amount_cents: number; counter_cents: number | null }>`
      select status, amount_cents, counter_cents from offers
      where listing_id = ${item.id} and buyer_id = ${context.userId} and phase = ${ended ? "overtime" : "sale"}
      order by created_at desc limit 1
    `;
    const offer = offerRows[0];
    const asking = clearance > 0 ? clearance : Number(item.price_cents);
    const offerState = offer
      ? {
          status: offer.status,
          amountCents: Number(offer.amount_cents),
          counterCents: offer.counter_cents == null ? null : Number(offer.counter_cents),
        }
      : null;
    const payAsking = Boolean(data.payAsking) || !offerState || offerState.status === "pending" || offerState.status === "declined";
    const base = payAsking ? asking : payBaseCents(asking, offerState);
    const fees = await loadFees(sql);
    const sellerTier = await viewerTier(sql, item.seller_id);
    const quote = checkoutQuote(
      fees,
      base,
      { buyer: me.isPremium, sellerTier },
      data.meet === "person" ? "person" : data.meet === "public" ? "public" : "official",
    );
    const buyerFee = quote.buyerFeeCents + quote.handoffFeeCents;
    const sellerFee = quote.sellerFeeCents + quote.sellerHandoffFeeCents;
    const tax = quote.salesTaxCents;
    const total = quote.youPayCents;
    if (me.walletCents < total) {
      throw new Error(
        TEST_MODE
          ? "Add more test credits on You. Not real money. This item is still available."
          : "Add more to your wallet to pay. This item is still available.",
      );
    }
    const metro = cityOf(item.neighborhood);
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
      handoffType = "public";
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
    const held = await sql<{ id: string }>`
      update listings set status = ${"held"}
      where id = ${item.id} and status in (${"live"}, ${"bundle"})
      returning id
    `;
    if (!held[0]) throw new Error("Someone else just held this.");
    let shelf: { packageNo: number; spotId: string } | null = null;
    if (item.charity_split) {
      shelf = await claimHouseShelf(sql, item.id);
      if (!shelf) {
        await sql`update listings set status = ${item.status} where id = ${item.id} and status = ${"held"}`;
        throw new Error("This shelf item isn’t available.");
      }
    }
    try {
      await holdBundleChildren(sql, item.id);
    } catch (error) {
      if (shelf) await releaseHouseClaim(sql, item.id);
      await sql`update listings set status = ${item.status} where id = ${item.id} and status = ${"held"}`;
      throw error;
    }
    const charged = await sql<{ id: string }>`
      update profiles set wallet_cents = wallet_cents - ${total}
      where id = ${context.userId} and wallet_cents >= ${total}
      returning id
    `;
    if (!charged[0]) {
      if (shelf) await releaseHouseClaim(sql, item.id);
      await releaseBundleChildren(sql, item.id);
      await sql`update listings set status = ${item.status} where id = ${item.id} and status = ${"held"}`;
      throw new Error(
        TEST_MODE
          ? "Add more test credits on You. Not real money. This item is still available."
          : "Add more to your wallet to pay. This item is still available.",
      );
    }
    const sellerScan = partyScan("S");
    const buyerScan = partyScan("B");
    const code = pickupCode();
    const orderId = crypto.randomUUID();
    await sql`
      insert into orders (
        id, listing_id, buyer_id, seller_id, amount_cents, fee_cents, tax_cents, buyer_fee_cents, seller_fee_cents,
        buyer_percent_cents, buyer_store_cents, seller_percent_cents, seller_store_cents, buyer_paid_cents, metro,
        status, pickup_code, seller_scan, buyer_scan, handoff_type, handoff_spot_id, buyer_confirmed, seller_confirmed
      )
      values (
        ${orderId}, ${item.id}, ${context.userId}, ${item.seller_id}, ${base}, ${buyerFee}, ${tax}, ${buyerFee}, ${sellerFee},
        ${quote.buyerFeeCents}, ${quote.handoffFeeCents}, ${quote.sellerFeeCents}, ${quote.sellerHandoffFeeCents}, ${total}, ${metro},
        ${"escrow"}, ${code}, ${sellerScan}, ${buyerScan}, ${handoffType}, ${spotId}, ${false}, ${isSeedUser(item.seller_id)}
      )
    `;
    if (shelf) {
      await sql`
        update orders
        set package_no = ${shelf.packageNo}, checked_in_at = now(), handoff_type = ${"official"}, handoff_spot_id = ${shelf.spotId}
        where id = ${orderId}
      `;
      await writeNotice(sql, {
        userId: context.userId,
        kind: "ready",
        title: "Already at the official store",
        body: "This was left at the Fargo store. Bring your buyer code. They will not say your name.",
        refId: orderId,
      });
    }
    await writeLedger(sql, { orderId, userId: context.userId, account: "customer_hold", amountCents: base, note: item.title });
    if (quote.buyerFeeCents) {
      await writeLedger(sql, { orderId, userId: context.userId, account: "fee_buyer_percent", amountCents: quote.buyerFeeCents, note: "Buyer fee" });
    }
    if (quote.handoffFeeCents) {
      await writeLedger(sql, { orderId, userId: context.userId, account: "fee_buyer_store", amountCents: quote.handoffFeeCents, note: "Official store, buyer" });
    }
    if (tax) {
      await writeLedger(sql, { orderId, userId: context.userId, account: "tax_payable", amountCents: tax, note: metro });
    }
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
    await voidBuyerBundlesContaining(sql, item.id);
    for (const child of await childIds(sql, item.id)) {
      await sql`
        update offers set status = ${"declined"}, updated_at = now()
        where listing_id = ${child} and status in (${"pending"}, ${"countered"})
      `;
      await voidBuyerBundlesContaining(sql, child);
    }
    return { orderId, pickupCode: code, feeCents: buyerFee };
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
      seller_fee_cents: number;
      status: string;
      pickup_code: string;
      buyer_confirmed: boolean;
      seller_confirmed: boolean;
      handoff_type: string;
    }>`select id, listing_id, buyer_id, seller_id, amount_cents, fee_cents, seller_fee_cents, status, pickup_code, buyer_confirmed, seller_confirmed, handoff_type from orders where id = ${data.orderId}`;
    const order = rows[0];
    if (!order) throw new Error("Pickup not found.");
    if (order.status !== "escrow") throw new Error("Already finished.");
    if (order.handoff_type === "official") {
      throw new Error("An official store closes when the counter scans the buyer code.");
    }
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
      await settleOrder(sql, order.id);
      return { done: true };
    }
    return { done: false };
  });

export async function settleOrder(sql: Awaited<ReturnType<typeof getSql>>, orderId: string) {
  const rows = await sql<{
    id: string;
    listing_id: string;
    seller_id: string;
    amount_cents: number;
    seller_fee_cents: number;
    status: string;
    handoff_type: string;
  }>`
    select id, listing_id, seller_id, amount_cents, seller_fee_cents, status, handoff_type
    from orders where id = ${orderId}
  `;
  const order = rows[0];
  if (!order || order.status !== "escrow") return;
  const fees = await loadFees(sql);
  const sellerTier = await viewerTier(sql, order.seller_id);
  const meet =
    order.handoff_type === "person" || order.handoff_type === "porch"
      ? "person"
      : order.handoff_type === "public"
        ? "public"
        : "official";
  const quote = checkoutQuote(fees, Number(order.amount_cents), { sellerTier }, meet);
  const storedSellerFee = Number(order.seller_fee_cents ?? 0);
  const payout = storedSellerFee > 0 ? Number(order.amount_cents) - storedSellerFee : quote.youGetCents;
  const payableAt = new Date(Date.now() + PAYOUT_HOLD_HOURS * 60 * 60 * 1000).toISOString();
  const won = await sql<{ id: string }>`
    update orders
    set status = ${"picked_up"}, buyer_confirmed = ${true}, seller_confirmed = ${true},
        released_at = coalesce(released_at, now()),
        payable_at = ${payableAt}::timestamptz,
        payout_cents = ${payout}
    where id = ${order.id} and status = ${"escrow"}
    returning id
  `;
  if (!won[0]) return;
  await sql`update listings set status = ${"sold"} where id = ${order.listing_id}`;
  await soldBundleChildren(sql, order.listing_id);
  if (quote.sellerFeeCents) {
    await writeLedger(sql, { orderId: order.id, userId: order.seller_id, account: "fee_seller_percent", amountCents: quote.sellerFeeCents, note: "Seller fee" });
  }
  if (quote.sellerHandoffFeeCents) {
    await writeLedger(sql, { orderId: order.id, userId: order.seller_id, account: "fee_seller_store", amountCents: quote.sellerHandoffFeeCents, note: "Official store, seller" });
  }
  await writeLedger(sql, { orderId: order.id, userId: order.seller_id, account: "seller_payable", amountCents: payout, note: "Waiting 48 hours" });
  const waitCopy = TEST_MODE
    ? "Handoff is done. The seller is paid in 48 hours if the buyer doesn’t report a problem. Test credits, not real money."
    : "Handoff is done. The seller is paid in 48 hours if the buyer doesn’t report a problem.";
  const buyerId = await sql<{ buyer_id: string }>`select buyer_id from orders where id = ${order.id}`;
  if (buyerId[0]) {
    await writeNotice(sql, { userId: buyerId[0].buyer_id, kind: "handoff", title: "You have the item", body: waitCopy, refId: order.id });
  }
  await writeNotice(sql, { userId: order.seller_id, kind: "handoff", title: "Handoff done", body: waitCopy, refId: order.id });
  await grantRep(sql, order.seller_id, "sale_done", 1, order.id);
  if (buyerId[0]) await grantRep(sql, buyerId[0].buyer_id, "buy_done", 1, order.id);
  await awardCleanRun(sql, order.seller_id);
}

export const getInbox = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<InboxPayload> => {
    const sql = await getSql();
    await releaseDuePayouts(sql);
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
      payable_at: string | null;
      paid_out_at: string | null;
      dispute_status: string | null;
      checked_in_at: string | null;
      disposition: string | null;
      handoff_spot_id: string | null;
      package_no: number | null;
      charity_split: boolean;
    }>`
      select o.id, o.listing_id, l.title as listing_title, l.photo_url as listing_photo,
             o.buyer_id, b.handle as buyer_handle, o.seller_id, se.handle as seller_handle,
             o.amount_cents, o.fee_cents, o.status, o.pickup_code, o.buyer_confirmed, o.seller_confirmed,
             o.handoff_type, o.created_at, o.payable_at, o.paid_out_at, o.dispute_status, o.checked_in_at,
             o.disposition, o.handoff_spot_id, o.package_no, l.charity_split
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
        payableAt: o.payable_at,
        paidOutAt: o.paid_out_at,
        disputeStatus: o.dispute_status,
        checkedIn: Boolean(o.checked_in_at),
        disposition: o.disposition === "pickup" || o.disposition === "abandoned" ? o.disposition : null,
        canLeave:
          o.seller_id === context.userId &&
          o.status === "cancelled" &&
          Boolean(o.checked_in_at) &&
          !o.disposition &&
          o.package_no != null &&
          !o.charity_split &&
          Boolean(houseForSpot(o.handoff_spot_id)),
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
      pendingRates: await loadPendingRates(sql, context.userId),
      notices: (
        await sql<{ id: string; title: string; body: string; created_at: string }>`
          select id, title, body, created_at from notices
          where user_id = ${context.userId}
          order by created_at desc
          limit 12
        `
      ).map(
        (n): Notice => ({
          id: n.id,
          title: n.title,
          body: n.body,
          createdAt: n.created_at,
        }),
      ),
    };
  });

export const getOrder = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await releaseDuePayouts(sql);
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
      seller_scan: string | null;
      buyer_scan: string | null;
      buyer_confirmed: boolean;
      seller_confirmed: boolean;
      handoff_type: Order["handoffType"];
      created_at: string;
      payable_at: string | null;
      paid_out_at: string | null;
      dispute_status: string | null;
      checked_in_at: string | null;
      disposition: string | null;
      handoff_spot_id: string | null;
      package_no: number | null;
      charity_split: boolean;
    }>`
      select o.id, o.listing_id, l.title as listing_title, l.photo_url as listing_photo,
             o.buyer_id, b.handle as buyer_handle, o.seller_id, se.handle as seller_handle,
             o.amount_cents, o.fee_cents, o.status, o.pickup_code, o.seller_scan, o.buyer_scan,
             o.buyer_confirmed, o.seller_confirmed, o.handoff_type, o.created_at,
             o.payable_at, o.paid_out_at, o.dispute_status, o.checked_in_at,
             o.disposition, o.handoff_spot_id, o.package_no, l.charity_split
      from orders o
      join listings l on l.id = o.listing_id
      join profiles b on b.id = o.buyer_id
      join profiles se on se.id = o.seller_id
      where o.id = ${id} and (o.buyer_id = ${context.userId} or o.seller_id = ${context.userId})
    `;
    const o = rows[0];
    if (!o) return null;
    const mine = await sql<{ overall: string }>`
      select overall from ratings where order_id = ${o.id} and rater_id = ${context.userId}
    `;
    const iAmBuyer = o.buyer_id === context.userId;
    const other = iAmBuyer
      ? await sql<{ verified_at: string | null }>`select verified_at from profiles where id = ${o.seller_id}`
      : await sql<{ verified_at: string | null }>`select verified_at from profiles where id = ${o.buyer_id}`;
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
      myScan: iAmBuyer ? o.buyer_scan : o.seller_scan,
      buyerConfirmed: Boolean(o.buyer_confirmed),
      sellerConfirmed: Boolean(o.seller_confirmed),
      handoffType: o.handoff_type,
      createdAt: o.created_at,
      payableAt: o.payable_at,
      paidOutAt: o.paid_out_at,
      disputeStatus: o.dispute_status,
      checkedIn: Boolean(o.checked_in_at),
      disposition: o.disposition === "pickup" || o.disposition === "abandoned" ? o.disposition : null,
      canLeave:
        o.seller_id === context.userId &&
        o.status === "cancelled" &&
        Boolean(o.checked_in_at) &&
        !o.disposition &&
        o.package_no != null &&
        !o.charity_split &&
        Boolean(houseForSpot(o.handoff_spot_id)),
      myRatingOverall: mine[0]?.overall === "up" || mine[0]?.overall === "down" ? mine[0].overall : null,
      otherVerified: Boolean(other[0]?.verified_at),
      meetupNote:
        o.handoff_type === "person"
          ? (
              await sql<{ meetup_note: string | null }>`
                select s.meetup_note from sales s
                join listings l on l.sale_id = s.id
                where l.id = ${o.listing_id}
              `
            )[0]?.meetup_note ?? null
          : (await sql<{ address: string | null; spot_id: string | null }>`
              select hs.address, orders.handoff_spot_id as spot_id
              from orders
              left join handoff_spots hs on hs.id = orders.handoff_spot_id
              where orders.id = ${o.id}
            `).map((row) => row.address?.trim() || (row.spot_id ? SPOT_ADDRESS[row.spot_id] ?? null : null))[0] ?? null,
    } satisfies Order;
  });

export const verifyId = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!IDENTITY_ENABLED) throw new Error("ID checks are off during beta.");
    const sql = await getSql();
    const me = await ensureProfile(sql, context.userId);
    if (me.verified && me) return { verified: true as const, chargedCents: 0, url: null as string | null };
    if (!me.legalFirstName || !me.legalLastName) {
      throw new Error("Add your legal name on your account before an ID check.");
    }
    await assertIdAvailable(sql, context.userId);
    const started = await beginIdentity(sql, me.id);
    return { verified: false as const, chargedCents: 0, url: started.url };
  });

export const finishIdentityCheck = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => completeIdentitySession(context.userId));

/** Shared by the browser return and the Stripe webhook. Idempotent. Does not store the ID photo. */
export async function completeIdentitySession(profileId: string, sessionId?: string) {
  if (!IDENTITY_ENABLED) throw new Error("ID checks are off during beta.");
  const sql = await getSql();
  const me = await ensureProfile(sql, profileId);
  if (me.verified) return { verified: true as const, chargedCents: 0 };
  const result = await finishIdentity(sql, profileId, sessionId);
  if (result.outcome === "pending") throw new Error("The ID check is still running. Check back in a minute.");
  if (result.outcome === "mismatch") {
    throw new Error("The name on the account does not match the ID. No badge.");
  }
  if (result.outcome !== "verified" || !result.sessionId) throw new Error("The ID check did not finish. No badge.");
  const existing = await sql<{ status: string }>`
    select status from identity_checks where session_id = ${result.sessionId}
  `;
  if (existing[0]?.status === "verified") {
    await sql`update profiles set verified_at = coalesce(verified_at, now()), identity_provider = ${"stripe"} where id = ${me.id}`;
    return { verified: true as const, chargedCents: 0 };
  }
  const used = await sql<{ n: number }>`
    select count(*)::int as n from identity_checks where provider = ${"stripe"} and status = ${"verified"}
  `;
  if (Number(used[0]?.n ?? 0) >= IDENTITY_CAP) throw new Error("ID checks are paused. The cap of 50 has been reached.");
  if (result.govFingerprint) {
    const taken = await sql<{ profile_id: string; active: boolean }>`
      select profile_id, active from identity_locks where fingerprint = ${result.govFingerprint}
    `;
    if (taken[0]?.active && taken[0].profile_id !== me.id) {
      await sql`update identity_checks set status = ${"id_in_use"} where session_id = ${result.sessionId} and status = ${"started"}`;
      throw new Error("This ID already has a live account. One account at a time. Email support to reset — ratings stay with the ID.");
    }
  }
  const fees = await loadFees(sql);
  const row = feeById(fees, "id_verify");
  const charge = me.isPremium ? 0 : row?.enabled ? (row.unit === "cents" ? row.amountCents : 0) : 0;
  const marked = await sql<{ id: string }>`
    update identity_checks set status = ${"verified"}
    where session_id = ${result.sessionId} and status = ${"started"}
    returning id
  `;
  if (!marked[0]) return { verified: false as const, chargedCents: 0 };
  try {
    if (charge > 0) await debitWallet(sql, me.id, charge);
  } catch (error) {
    await sql`update identity_checks set status = ${"started"} where session_id = ${result.sessionId}`;
    throw error;
  }
  await sql`update profiles set verified_at = now(), identity_provider = ${"stripe"} where id = ${me.id}`;
  if (charge > 0) {
    await sql`
      insert into wallet_tx (id, user_id, kind, amount_cents, note)
      values (${crypto.randomUUID()}, ${me.id}, ${"verify"}, ${-charge}, ${"ID Verified. No ID photo stored."})
    `;
  }
  await claimIdentity(sql, me.id);
  if (result.govFingerprint) {
    const thumbs = await sql<{ thumbs_up: number; thumbs_down: number }>`
      select thumbs_up, thumbs_down from profiles where id = ${me.id}
    `;
    await sql`
      insert into identity_locks (fingerprint, kind, profile_id, active, thumbs_up, thumbs_down, released_at)
      values (
        ${result.govFingerprint},
        ${"gov_id"},
        ${me.id},
        ${true},
        ${Number(thumbs[0]?.thumbs_up ?? 0)},
        ${Number(thumbs[0]?.thumbs_down ?? 0)},
        ${null}
      )
      on conflict (fingerprint) do update set
        profile_id = ${me.id},
        active = true,
        released_at = null,
        updated_at = now()
    `;
  }
  return { verified: true as const, chargedCents: charge };
}

export const submitRating = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        orderId: z.string(),
        showedUp: z.enum(["up", "down"]),
        asAgreed: z.enum(["up", "down"]),
        respectful: z.enum(["up", "down"]),
        packaged: z.enum(["up", "down"]).optional(),
        comment: z.string().max(500).optional(),
        photoUrl: z.string().max(1_500_000).optional(),
        counterReady: z.enum(["up", "down"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const rows = await sql<{
      id: string;
      buyer_id: string;
      seller_id: string;
      status: string;
    }>`select id, buyer_id, seller_id, status from orders where id = ${data.orderId}`;
    const order = rows[0];
    if (!order) throw new Error("Pickup not found.");
    if (order.status !== "picked_up") throw new Error("Rate after you both confirm pickup.");
    const isBuyer = order.buyer_id === context.userId;
    const isSeller = order.seller_id === context.userId;
    if (!isBuyer && !isSeller) throw new Error("Not your handoff.");
    if (isBuyer && !data.packaged) throw new Error("Rate how it was packed for the handoff.");
    const subjectId = isBuyer ? order.seller_id : order.buyer_id;
    const existing = await sql<{ id: string }>`
      select id from ratings where order_id = ${order.id} and rater_id = ${context.userId}
    `;
    if (existing[0]) throw new Error("You already rated this handoff.");
    const marks = {
      showed_up: data.showedUp as Thumb,
      as_agreed: data.asAgreed as Thumb,
      respectful: data.respectful as Thumb,
      packaged: isBuyer ? (data.packaged as Thumb) : null,
    };
    const overall = overallThumb(marks);
    const comment = data.comment?.trim() ? data.comment.trim() : null;
    const photo = data.photoUrl ? await storePhoto(safePhoto(data.photoUrl), `ratings/${crypto.randomUUID()}`) : null;
    await sql`
      insert into ratings (
        id, order_id, rater_id, subject_id, role,
        showed_up, as_agreed, respectful, packaged, overall, comment, photo_url
      ) values (
        ${crypto.randomUUID()}, ${order.id}, ${context.userId}, ${subjectId},
        ${isBuyer ? "buyer" : "seller"},
        ${marks.showed_up}, ${marks.as_agreed}, ${marks.respectful}, ${marks.packaged}, ${overall}, ${comment}, ${photo}
      )
    `;
    await recountThumbs(sql, subjectId);
    if (data.counterReady) {
      await ensureApproach(sql);
      const spot = await sql<{ spot: string | null; handoff_type: string }>`
        select handoff_spot_id as spot, handoff_type from orders where id = ${order.id}
      `;
      if (spot[0]?.handoff_type === "official" && spot[0].spot) {
        await sql`
          insert into spot_marks (id, order_id, spot_id, rater_id, ready)
          values (${crypto.randomUUID()}, ${order.id}, ${spot[0].spot}, ${context.userId}, ${data.counterReady})
          on conflict (order_id, rater_id) do nothing
        `;
      }
    }
    if (isBuyer) {
      await grantRep(
        sql,
        order.seller_id,
        data.asAgreed === "up" ? "agreed_up" : "agreed_down",
        data.asAgreed === "up" ? 2 : -2,
        order.id,
      );
    }
    return { overall };
  });

export const challengeRating = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ ratingId: z.string(), note: z.string().min(8).max(500) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const rows = await sql<{ id: string; subject_id: string; overall: string }>`
      select id, subject_id, overall from ratings where id = ${data.ratingId}
    `;
    const rating = rows[0];
    if (!rating) throw new Error("Rating not found.");
    if (rating.subject_id !== context.userId) throw new Error("You can only challenge a thumbs down on you.");
    if (rating.overall !== "down") throw new Error("Only a thumbs down can be challenged.");
    const already = await sql<{ id: string }>`select id from rating_challenges where rating_id = ${rating.id}`;
    if (already[0]) throw new Error("Already challenged.");
    await sql`
      insert into rating_challenges (id, rating_id, by_id, note, status)
      values (${crypto.randomUUID()}, ${rating.id}, ${context.userId}, ${data.note.trim()}, ${"open"})
    `;
    await recountThumbs(sql, context.userId);
    return { ok: true as const };
  });

export const exportMyData = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const uid = context.userId;
    await ensureProfile(sql, uid);
    const account = await sql.query<{ name: string; email: string; created_at: string }>(
      `select name, email, "createdAt" as created_at from "user" where id = $1`,
      [uid],
    );
    const profile = await sql<{
      handle: string;
      neighborhood: string | null;
      zip: string | null;
      city: string | null;
      legal_first_name: string | null;
      legal_last_name: string | null;
      phone: string | null;
      is_premium: boolean;
      plus_plan: string | null;
      plus_until: string | null;
      verified_at: string | null;
      thumbs_up: number;
      thumbs_down: number;
      rep: number;
      wallet_cents: number;
    }>`
      select handle, neighborhood, zip, city, legal_first_name, legal_last_name, phone, is_premium, plus_plan, plus_until, verified_at,
             thumbs_up, thumbs_down, rep, wallet_cents
      from profiles where id = ${uid}
    `;
    const me = profile[0];
    const sales = await sql`
      select id, name, kind, neighborhood, starts_on, ends_on, status, handoff_modes,
             online_start_dow, online_end_dow, live_on, live_start_dow, live_end_dow,
             live_open, live_close, meetup_note, created_at
      from sales where seller_id = ${uid} order by created_at
    `;
    const listings = await sql`
      select id, sale_id, title, description, price_cents, floor_cents, category, condition,
             haul, size_label, neighborhood, handoff_modes, photo_url, status, created_at
      from listings where seller_id = ${uid} order by created_at
    `;
    const offers = await sql<{
      id: string;
      listing_id: string;
      title: string;
      role: string;
      other_handle: string;
      amount_cents: number;
      counter_cents: number | null;
      status: string;
      note: string | null;
      created_at: string;
    }>`
      select o.id, o.listing_id, l.title,
             case when o.buyer_id = ${uid} then ${"buyer"} else ${"seller"} end as role,
             case when o.buyer_id = ${uid} then se.handle else b.handle end as other_handle,
             o.amount_cents, o.counter_cents, o.status, o.note, o.created_at
      from offers o
      join listings l on l.id = o.listing_id
      join profiles b on b.id = o.buyer_id
      join profiles se on se.id = o.seller_id
      where o.buyer_id = ${uid} or o.seller_id = ${uid}
      order by o.created_at
    `;
    const messages = await sql<{
      id: string;
      listing_id: string;
      title: string;
      direction: string;
      other_handle: string;
      body: string;
      created_at: string;
    }>`
      select m.id, m.listing_id, l.title,
             case when m.from_id = ${uid} then ${"sent"} else ${"received"} end as direction,
             case when m.from_id = ${uid} then t.handle else f.handle end as other_handle,
             m.body, m.created_at
      from messages m
      join listings l on l.id = m.listing_id
      join profiles f on f.id = m.from_id
      join profiles t on t.id = m.to_id
      where m.from_id = ${uid} or m.to_id = ${uid}
      order by m.created_at
    `;
    const orders = await sql<{
      id: string;
      listing_id: string;
      title: string;
      role: string;
      other_handle: string;
      amount_cents: number;
      fee_cents: number;
      tax_cents: number;
      status: string;
      handoff_type: string;
      pickup_code: string;
      buyer_confirmed: boolean;
      seller_confirmed: boolean;
      created_at: string;
    }>`
      select o.id, o.listing_id, l.title,
             case when o.buyer_id = ${uid} then ${"buyer"} else ${"seller"} end as role,
             case when o.buyer_id = ${uid} then se.handle else b.handle end as other_handle,
             o.amount_cents, o.fee_cents, o.tax_cents, o.status, o.handoff_type, o.pickup_code,
             o.buyer_confirmed, o.seller_confirmed, o.created_at
      from orders o
      join listings l on l.id = o.listing_id
      join profiles b on b.id = o.buyer_id
      join profiles se on se.id = o.seller_id
      where o.buyer_id = ${uid} or o.seller_id = ${uid}
      order by o.created_at
    `;
    const wallet = await sql`
      select id, kind, amount_cents, note, created_at
      from wallet_tx where user_id = ${uid} order by created_at
    `;
    const ratingsGiven = await sql<{
      id: string;
      order_id: string;
      other_handle: string;
      overall: string;
      comment: string | null;
      photo_url: string | null;
      created_at: string;
    }>`
      select r.id, r.order_id, p.handle as other_handle, r.overall, r.comment, r.photo_url, r.created_at
      from ratings r join profiles p on p.id = r.subject_id
      where r.rater_id = ${uid} order by r.created_at
    `;
    const ratingsReceived = await sql<{
      id: string;
      order_id: string;
      other_handle: string;
      overall: string;
      created_at: string;
    }>`
      select r.id, r.order_id, p.handle as other_handle, r.overall, r.created_at
      from ratings r join profiles p on p.id = r.rater_id
      where r.subject_id = ${uid} order by r.created_at
    `;
    const saved = await sql<{ listing_id: string }>`
      select listing_id from saved_listings where user_id = ${uid}
    `;
    const notices = await sql`
      select id, kind, title, body, created_at from notices where user_id = ${uid} order by created_at
    `;
    const day = new Date().toISOString().slice(0, 10);
    const json = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        product: "Rummlee",
        about: "Your account data. Other people are handles only. This file has no one else’s email, and no home address from a public listing.",
        account: account[0]
          ? { email: account[0].email, name: account[0].name, createdAt: String(account[0].created_at) }
          : null,
        profile: me
          ? {
              handle: me.handle,
              neighborhood: me.neighborhood,
              city: me.city,
              zip: me.zip,
              legalFirstName: me.legal_first_name,
              legalLastName: me.legal_last_name,
              phone: me.phone,
              privateNote: "Legal name and phone are on this account only. They are not on listings.",
              plus: Boolean(me.is_premium),
              plusPlan: me.plus_plan,
              plusUntil: me.plus_until ? String(me.plus_until) : null,
              verified: Boolean(me.verified_at),
              thumbsUp: Number(me.thumbs_up),
              thumbsDown: Number(me.thumbs_down),
              rep: Number(me.rep ?? 100),
              walletCents: Number(me.wallet_cents),
            }
          : null,
        sales,
        listings,
        offers,
        messages,
        orders,
        wallet,
        ratingsGiven,
        ratingsReceived,
        savedListingIds: saved.map((row) => row.listing_id),
        notices,
      },
      null,
      2,
    );
    return { filename: `rummlee-data-${day}.json`, json };
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
    const snap = await sql<{ thumbs_up: number; thumbs_down: number; verified_at: string | null }>`
      select thumbs_up, thumbs_down, verified_at from profiles where id = ${uid}
    `;
    await sql`
      update identity_locks
      set thumbs_up = ${Number(snap[0]?.thumbs_up ?? 0)},
          thumbs_down = ${Number(snap[0]?.thumbs_down ?? 0)},
          active = ${Boolean(snap[0]?.verified_at)},
          updated_at = now()
      where profile_id = ${uid}
    `;
    await syncIdentity(sql, uid);
    const open = await sql<{ id: string }>`
      select id from orders
      where (buyer_id = ${uid} or seller_id = ${uid}) and status = ${"escrow"}
    `;
    for (const order of open) {
      const refunded = await refundEscrow(sql, order.id, "Account closed before handoff");
      if (!refunded) continue;
      const other = refunded.buyer_id === uid ? refunded.seller_id : refunded.buyer_id;
      await writeNotice(sql, {
        userId: other,
        kind: "refund",
        title: "Handoff cancelled",
        body: "The other person closed their account before pickup. The buyer was refunded in test credits.",
        refId: order.id,
      });
    }
    await sql`update listings set status = ${"withdrawn"} where seller_id = ${uid} and status = ${"live"}`;
    await sql`delete from messages where from_id = ${uid} or to_id = ${uid}`;
    await sql.query(`delete from "session" where "userId" = $1`, [uid]);
    const closed = `closed-${uid}`;
    await sql`
      update profiles set
        deleted_at = now(),
        handle = ${closed},
        neighborhood = null,
        zip = null,
        is_premium = false,
        plus_plan = null,
        plus_tier = null,
        plus_until = null,
        desk_spot_id = null
      where id = ${uid}
    `;
    return { ok: true as const };
  });

export const releaseIdentity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ handle: z.string().min(2).max(40) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const staff = await ensureProfile(sql, context.userId);
    if (!staff.isStaff) throw new Error("Support only.");
    const handle = data.handle.replace(/^@/, "").trim().toLowerCase();
    const rows = await sql<{ id: string }>`select id from profiles where lower(handle) = ${handle}`;
    const target = rows[0];
    if (!target) throw new Error("No handle by that name.");
    await syncIdentity(sql, target.id);
    await claimIdentity(sql, target.id);
    await sql`update profiles set verified_at = now() where id = ${target.id}`;
    return { ok: true as const, handle };
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
    const claimed = await sql<{ id: string }>`
      update profiles set is_staff = true
      where id = ${context.userId}
        and not exists (select 1 from profiles where is_staff = true)
      returning id
    `;
    if (!claimed[0]) throw new Error("An operator account is already set.");
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


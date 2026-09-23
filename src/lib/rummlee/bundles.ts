import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { splitModes } from "./format";
import { mapFeeRow, minAskingCents, DEFAULT_FEES } from "./fees";
import type { HandoffMode } from "./types";

type Sql = Awaited<ReturnType<typeof getSql>>;

type ItemRow = {
  id: string;
  seller_id: string;
  sale_id: string;
  title: string;
  price_cents: number;
  floor_cents: number | null;
  status: string;
  neighborhood: string;
  handoff_modes: string;
  photo_url: string;
  pack: string | null;
  weight_lbs: number | null;
  haul: string;
  category: string;
  condition: string;
  bundle_kind: string | null;
};

export function bundleFitsOfficial(items: Pick<ItemRow, "pack" | "weight_lbs" | "haul">[]) {
  if (items.some((item) => item.pack === "as_is" || item.haul === "truck" || item.weight_lbs == null)) return false;
  const sum = items.reduce((total, item) => total + Number(item.weight_lbs), 0);
  return sum <= 50;
}

function intersectModes(items: ItemRow[]): HandoffMode[] {
  let modes = splitModes(items[0]?.handoff_modes ?? "official");
  for (const item of items.slice(1)) {
    const next = new Set(splitModes(item.handoff_modes));
    modes = modes.filter((mode) => next.has(mode));
  }
  return modes.length ? modes : ["person"];
}

async function readyProfile(sql: Sql, userId: string) {
  const rows = await sql<{ id: string }>`
    select id from profiles
    where id = ${userId}
      and legal_first_name is not null and legal_last_name is not null
      and phone is not null and neighborhood is not null
  `;
  if (!rows[0]) throw new Error("Finish your account first. Your legal name and phone stay private.");
}

async function feeTable(sql: Sql) {
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
  }>`select id, label, description, unit, percent_bps, amount_cents, charged_to, charged_when, sort, enabled from rummlee_fees`;
  return rows.length ? rows.map((row) => mapFeeRow(row)) : DEFAULT_FEES;
}

async function loadItems(sql: Sql, ids: string[]) {
  const rows: ItemRow[] = [];
  for (const id of ids) {
    const found = await sql<ItemRow>`
      select id, seller_id, sale_id, title, price_cents, floor_cents, status, neighborhood, handoff_modes,
             photo_url, pack, weight_lbs, haul, category, condition, bundle_kind
      from listings where id = ${id}
    `;
    if (found[0]) rows.push(found[0]);
  }
  return rows;
}

function sameSellerLive(items: ItemRow[], ids: string[]) {
  if (items.length !== ids.length || items.length < 2) throw new Error("Pick at least two items.");
  if (items.length > 8) throw new Error("A bundle can hold up to 8 items.");
  const seller = items[0].seller_id;
  const neighborhood = items[0].neighborhood;
  if (items.some((item) => item.seller_id !== seller)) throw new Error("A bundle stays with one seller.");
  if (items.some((item) => item.neighborhood !== neighborhood)) throw new Error("Bundle items have to be in the same neighborhood.");
  if (items.some((item) => item.bundle_kind)) throw new Error("One of those is already a bundle.");
  if (items.some((item) => item.status !== "live")) throw new Error("One of those items isn’t available.");
  return { seller, neighborhood };
}

async function insertBundleListing(
  sql: Sql,
  items: ItemRow[],
  opts: { kind: "seller" | "buyer"; title: string; priceCents: number; floorCents: number; buyerId: string | null; status: string },
) {
  const fits = bundleFitsOfficial(items);
  let modes = intersectModes(items);
  if (!fits) modes = modes.filter((mode) => mode !== "official");
  if (!modes.length) modes = ["person"];
  const weight = items.every((item) => item.weight_lbs != null)
    ? items.reduce((total, item) => total + Number(item.weight_lbs), 0)
    : null;
  const id = crypto.randomUUID();
  const names = items.map((item) => item.title).join(", ");
  await sql`
    insert into listings (
      id, sale_id, seller_id, title, description, price_cents, buy_now_cents, original_cents, floor_cents,
      category, condition, haul, pack, weight_lbs, neighborhood, handoff_modes, photo_url, status, bundle_kind, bundle_for
    ) values (
      ${id}, ${items[0].sale_id}, ${items[0].seller_id}, ${opts.title.slice(0, 80)},
      ${"Bundle: " + names},
      ${opts.priceCents}, ${opts.priceCents}, ${null}, ${opts.floorCents},
      ${"other"}, ${items[0].condition}, ${fits ? "one" : "truck"},
      ${fits ? "box" : "as_is"}, ${weight}, ${items[0].neighborhood},
      ${modes.join(",")}, ${items[0].photo_url}, ${opts.status}, ${opts.kind}, ${opts.buyerId}
    )
  `;
  for (const item of items) {
    await sql`insert into bundle_items (bundle_id, listing_id) values (${id}, ${item.id})`;
  }
  return id;
}

export async function childIds(sql: Sql, bundleId: string) {
  const rows = await sql<{ listing_id: string }>`select listing_id from bundle_items where bundle_id = ${bundleId}`;
  return rows.map((row) => row.listing_id);
}

export async function holdBundleChildren(sql: Sql, bundleId: string) {
  const kind = await sql<{ bundle_kind: string | null }>`select bundle_kind from listings where id = ${bundleId}`;
  const ids = await childIds(sql, bundleId);
  if (!ids.length) return;
  const expect = kind[0]?.bundle_kind === "seller" ? "bundled" : "live";
  for (const id of ids) {
    const held = await sql<{ id: string }>`
      update listings set status = ${"held"} where id = ${id} and status = ${expect} returning id
    `;
    if (!held[0]) {
      await releaseBundleChildren(sql, bundleId);
      throw new Error("One item in the bundle just sold. The offer is not used up. Build it again without that item.");
    }
  }
}

export async function releaseBundleChildren(sql: Sql, bundleId: string) {
  const kind = await sql<{ bundle_kind: string | null }>`select bundle_kind from listings where id = ${bundleId}`;
  const back = kind[0]?.bundle_kind === "seller" ? "bundled" : "live";
  const ids = await childIds(sql, bundleId);
  for (const id of ids) {
    await sql`update listings set status = ${back} where id = ${id} and status = ${"held"}`;
  }
}

export async function soldBundleChildren(sql: Sql, bundleId: string) {
  for (const id of await childIds(sql, bundleId)) {
    await sql`update listings set status = ${"sold"} where id = ${id}`;
  }
}

/** A sale of one item cancels an open buyer bundle that included it. The offer is not used up. */
export async function voidBuyerBundlesContaining(sql: Sql, listingId: string) {
  const rows = await sql<{ bundle_id: string }>`
    select b.bundle_id
    from bundle_items b
    join listings l on l.id = b.bundle_id
    where b.listing_id = ${listingId} and l.bundle_kind = ${"buyer"} and l.status = ${"bundle"}
  `;
  for (const row of rows) {
    await sql`
      update offers set status = ${"declined"}, declined_by = ${"void"}, updated_at = now()
      where listing_id = ${row.bundle_id} and status in (${"pending"}, ${"countered"}, ${"accepted"})
    `;
    await sql`update listings set status = ${"withdrawn"} where id = ${row.bundle_id} and status = ${"bundle"}`;
  }
}

/** A real decline uses up the one offer on every item. A void does not. */
export async function useBundleOffers(sql: Sql, bundleId: string, buyerId: string) {
  const kind = await sql<{ bundle_kind: string | null }>`select bundle_kind from listings where id = ${bundleId}`;
  if (kind[0]?.bundle_kind !== "buyer" && kind[0]?.bundle_kind !== "seller") return;
  for (const id of await childIds(sql, bundleId)) {
    await sql`
      insert into offer_uses (listing_id, buyer_id) values (${id}, ${buyerId})
      on conflict do nothing
    `;
  }
}

export const getBundleSheet = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((sellerId: string) => z.string().min(1).parse(sellerId))
  .handler(async ({ context, data: sellerId }) => {
    const sql = await getSql();
    await readyProfile(sql, context.userId);
    const seller = await sql<{ id: string; handle: string }>`select id, handle from profiles where id = ${sellerId}`;
    if (!seller[0]) throw new Error("Seller not found.");
    const items = await sql<{
      id: string;
      title: string;
      price_cents: number;
      photo_url: string;
      neighborhood: string;
    }>`
      select id, title, price_cents, photo_url, neighborhood
      from listings
      where seller_id = ${sellerId} and status = ${"live"} and bundle_kind is null
      order by created_at desc
      limit 40
    `;
    const used = await sql<{ listing_id: string }>`
      select listing_id from offers where buyer_id = ${context.userId}
      union
      select listing_id from offer_uses where buyer_id = ${context.userId}
    `;
    const usedIds = new Set(used.map((row) => row.listing_id));
    return {
      sellerId,
      sellerHandle: seller[0].handle,
      mine: context.userId === sellerId,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        priceCents: Number(item.price_cents),
        photoUrl: item.photo_url,
        neighborhood: item.neighborhood,
        offerUsed: usedIds.has(item.id),
      })),
    };
  });

export const createSellerBundle = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        listingIds: z.array(z.string()).min(2).max(8),
        title: z.string().min(2).max(80),
        priceCents: z.number().int().min(100),
        floorCents: z.number().int().min(100),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await readyProfile(sql, context.userId);
    const items = await loadItems(sql, data.listingIds);
    const { seller } = sameSellerLive(items, data.listingIds);
    if (seller !== context.userId) throw new Error("You can only bundle your own items.");
    const fees = await feeTable(sql);
    const min = minAskingCents(fees);
    if (data.priceCents < min || data.floorCents < min) throw new Error("Asking and lowest both have to meet the minimum.");
    if (data.floorCents > data.priceCents) throw new Error("Lowest price can’t be higher than asking.");
    const id = await insertBundleListing(sql, items, {
      kind: "seller",
      title: data.title.trim(),
      priceCents: data.priceCents,
      floorCents: data.floorCents,
      buyerId: null,
      status: "live",
    });
    for (const item of items) {
      await sql`update listings set status = ${"bundled"} where id = ${item.id} and status = ${"live"}`;
    }
    return { id };
  });

export const createBuyerBundle = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        listingIds: z.array(z.string()).min(2).max(8),
        amountCents: z.number().int().min(100).optional(),
        note: z.string().max(240).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await readyProfile(sql, context.userId);
    const items = await loadItems(sql, data.listingIds);
    const { seller } = sameSellerLive(items, data.listingIds);
    if (seller === context.userId) throw new Error("Bundle someone else’s items, or publish your own from the seller form.");
    for (const item of items) {
      const used = await sql<{ listing_id: string }>`
        select listing_id from offers where listing_id = ${item.id} and buyer_id = ${context.userId}
        union
        select listing_id from offer_uses where listing_id = ${item.id} and buyer_id = ${context.userId}
      `;
      if (used[0]) throw new Error(`You already used your one offer on “${item.title}”. You can still pay asking for it.`);
    }
    const asking = items.reduce((total, item) => total + Number(item.price_cents), 0);
    const floor = items.reduce((total, item) => total + Number(item.floor_cents ?? item.price_cents), 0);
    const title = items.map((item) => item.title).join(" + ").slice(0, 80);
    if (data.amountCents != null && data.amountCents >= asking) {
      throw new Error("That’s the total or more. Pay the total to hold all of them.");
    }
    const id = await insertBundleListing(sql, items, {
      kind: "buyer",
      title,
      priceCents: asking,
      floorCents: floor,
      buyerId: context.userId,
      status: "bundle",
    });
    if (data.amountCents == null) return { id, status: "pay" as const, asking };
    let status: "pending" | "declined" = "pending";
    let declinedBy: string | null = null;
    if (data.amountCents < floor) {
      status = "declined";
      declinedBy = "floor";
    }
    await sql`
      insert into offers (id, listing_id, buyer_id, seller_id, amount_cents, counter_cents, status, declined_by, note)
      values (
        ${crypto.randomUUID()}, ${id}, ${context.userId}, ${seller}, ${data.amountCents}, ${null},
        ${status}, ${declinedBy}, ${data.note ?? null}
      )
    `;
    if (status === "declined") await useBundleOffers(sql, id, context.userId);
    return { id, status, asking };
  });

export const dissolveBundle = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ listingId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await readyProfile(sql, context.userId);
    const rows = await sql<{ id: string; seller_id: string; status: string; bundle_kind: string | null }>`
      select id, seller_id, status, bundle_kind from listings where id = ${data.listingId}
    `;
    const bundle = rows[0];
    if (!bundle || bundle.seller_id !== context.userId) throw new Error("That’s not your bundle.");
    if (bundle.bundle_kind !== "seller" || bundle.status !== "live") throw new Error("This bundle can’t be taken down.");
    const open = await sql<{ id: string }>`
      select id from orders where listing_id = ${bundle.id} and status = ${"escrow"} limit 1
    `;
    if (open[0]) throw new Error("Someone is already paying for this bundle.");
    await sql`update listings set status = ${"withdrawn"} where id = ${bundle.id}`;
    for (const id of await childIds(sql, bundle.id)) {
      await sql`update listings set status = ${"live"} where id = ${id} and status = ${"bundled"}`;
    }
    await sql`
      update offers set status = ${"declined"}, declined_by = ${"void"}, updated_at = now()
      where listing_id = ${bundle.id} and status in (${"pending"}, ${"countered"})
    `;
    return { ok: true };
  });

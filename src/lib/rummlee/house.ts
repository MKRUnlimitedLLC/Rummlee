import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { CHARITY_SHARE_BPS, HOUSE_FARGO } from "./constants";
import { writeNotice } from "./books";

export { CHARITY_SHARE_BPS, HOUSE_FARGO };

type Sql = Awaited<ReturnType<typeof getSql>>;

export function houseForSpot(spotId: string | null | undefined) {
  if (spotId === HOUSE_FARGO.spotId) return HOUSE_FARGO;
  return null;
}

export function charityShare(payoutCents: number) {
  const charity = Math.floor((payoutCents * CHARITY_SHARE_BPS) / 10000);
  return { charity, keep: payoutCents - charity };
}

export async function ensureHouse(sql: Sql) {
  const taken = await sql<{ id: string }>`
    select id from profiles where handle = ${HOUSE_FARGO.handle} and id <> ${HOUSE_FARGO.profileId} limit 1
  `;
  const handle = taken[0] ? "rummlee_fargo" : HOUSE_FARGO.handle;
  await sql`
    insert into profiles (id, handle, neighborhood, is_house, is_premium, wallet_cents)
    values (${HOUSE_FARGO.profileId}, ${handle}, ${HOUSE_FARGO.neighborhood}, ${true}, ${false}, ${0})
    on conflict (id) do update set is_house = true
  `;
  await sql`
    insert into sales (
      id, seller_id, name, kind, neighborhood, starts_on, ends_on,
      handoff_modes, handoff_spot_id, status, channel, always_on
    )
    values (
      ${HOUSE_FARGO.saleId},
      ${HOUSE_FARGO.profileId},
      ${"Rummlee Fargo"},
      ${"house"},
      ${HOUSE_FARGO.neighborhood},
      current_date,
      (current_date + 3650),
      ${"official"},
      ${HOUSE_FARGO.spotId},
      ${"live"},
      ${"online"},
      ${true}
    )
    on conflict (id) do update set always_on = ${true}, status = ${"live"}, handoff_modes = ${"official"}
  `;
}

export async function orderIsCharity(sql: Sql, orderId: string) {
  const rows = await sql<{ charity_split: boolean }>`
    select l.charity_split
    from orders o
    join listings l on l.id = o.listing_id
    where o.id = ${orderId}
  `;
  return Boolean(rows[0]?.charity_split);
}

export async function recordCharity(sql: Sql, orderId: string, amountCents: number) {
  if (amountCents <= 0) return;
  await sql`
    insert into charity_ledger (id, order_id, market, amount_cents, note)
    values (
      ${crypto.randomUUID()},
      ${orderId},
      ${HOUSE_FARGO.market},
      ${amountCents},
      ${"Half of Rummlee seller proceeds on a left item. Liability, not revenue."}
    )
  `;
}

export async function claimHouseShelf(sql: Sql, listingId: string) {
  const won = await sql<{ package_no: number; spot_id: string }>`
    update house_stock set status = ${"held"}
    where listing_id = ${listingId} and status = ${"shelf"}
    returning package_no, spot_id
  `;
  const row = won[0];
  if (!row) return null;
  return { packageNo: Number(row.package_no), spotId: row.spot_id };
}

export async function releaseHouseClaim(sql: Sql, listingId: string) {
  await sql`
    update house_stock set status = ${"shelf"}
    where listing_id = ${listingId} and status = ${"held"}
  `;
}

/** A refused resale goes back on the shelf. It does not return to the first seller. */
export async function restoreHouseListing(sql: Sql, order: { id: string; listingId: string }) {
  const rows = await sql<{ charity_split: boolean }>`
    select charity_split from listings where id = ${order.listingId}
  `;
  if (!rows[0]?.charity_split) return false;
  await sql`
    update orders set released_at = coalesce(released_at, now())
    where id = ${order.id}
  `;
  await sql`update house_stock set status = ${"shelf"} where listing_id = ${order.listingId}`;
  await sql`update listings set status = ${"live"} where id = ${order.listingId} and status = ${"held"}`;
  return true;
}

export type HouseDesk = {
  market: string;
  saleId: string;
  charityCents: number;
  shelf: { title: string; priceCents: number; packageNo: number; status: string }[];
  waiting: { title: string; packageNo: number }[];
};

export async function loadHouseDesk(sql: Sql): Promise<HouseDesk> {
  await ensureHouse(sql);
  const charity = await sql<{ cents: number }>`
    select coalesce(sum(amount_cents), 0)::int as cents from charity_ledger
  `;
  const shelf = await sql<{ title: string; price_cents: number; package_no: number; status: string }>`
    select l.title, l.price_cents, h.package_no, h.status
    from house_stock h
    join listings l on l.id = h.listing_id
    where h.status in (${"shelf"}, ${"held"})
    order by h.created_at desc
    limit 40
  `;
  const waiting = await sql<{ title: string; package_no: number }>`
    select l.title, o.package_no
    from orders o
    join listings l on l.id = o.listing_id
    where o.handoff_spot_id = ${HOUSE_FARGO.spotId}
      and o.status = ${"cancelled"}
      and o.checked_in_at is not null
      and o.released_at is null
      and o.disposition is null
      and o.package_no is not null
    order by o.created_at desc
    limit 40
  `;
  return {
    market: HOUSE_FARGO.market,
    saleId: HOUSE_FARGO.saleId,
    charityCents: Number(charity[0]?.cents ?? 0),
    shelf: shelf.map((row) => ({
      title: row.title,
      priceCents: Number(row.price_cents),
      packageNo: Number(row.package_no),
      status: row.status,
    })),
    waiting: waiting.map((row) => ({ title: row.title, packageNo: Number(row.package_no) })),
  };
}

const LEAVE_NOTE =
  "Left at an official store. Rummlee is reselling it. Half of what Rummlee receives on this sale is set aside for charity.";

export const chooseDisposition = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ orderId: z.string(), choice: z.enum(["pickup", "abandon"]) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureHouse(sql);
    const rows = await sql<{
      id: string;
      seller_id: string;
      listing_id: string;
      status: string;
      handoff_type: string;
      handoff_spot_id: string | null;
      checked_in_at: string | null;
      package_no: number | null;
      disposition: string | null;
      charity_split: boolean;
      title: string;
      description: string;
      price_cents: number;
      original_cents: number | null;
      category: string;
      condition: string;
      haul: string;
      size_label: string | null;
      pack: string | null;
      weight_lbs: number | null;
      photo_url: string;
    }>`
      select o.id, o.seller_id, o.listing_id, o.status, o.handoff_type, o.handoff_spot_id,
             o.checked_in_at, o.package_no, o.disposition, l.charity_split,
             l.title, l.description, l.price_cents, l.original_cents, l.category, l.condition,
             l.haul, l.size_label, l.pack, l.weight_lbs, l.photo_url
      from orders o
      join listings l on l.id = o.listing_id
      where o.id = ${data.orderId}
    `;
    const order = rows[0];
    if (!order) throw new Error("Handoff not found.");
    if (order.seller_id !== context.userId) throw new Error("Only the seller can choose.");
    if (order.charity_split) throw new Error("This is already a Rummlee shelf item.");
    if (order.status !== "cancelled") throw new Error("Choose after the buyer is refunded.");
    if (!order.checked_in_at || order.package_no == null) {
      throw new Error("The store doesn’t have this package. Nothing to leave.");
    }
    if (order.disposition) throw new Error("You already chose.");
    const house = houseForSpot(order.handoff_spot_id);
    if (!house || order.handoff_type !== "official") {
      throw new Error("Leave-it is only open in Fargo–Moorhead for now. Hold it for pickup.");
    }

    if (data.choice === "pickup") {
      const won = await sql<{ id: string }>`
        update orders set disposition = ${"pickup"}, disposed_at = now()
        where id = ${order.id} and seller_id = ${context.userId} and disposition is null and status = ${"cancelled"}
        returning id
      `;
      if (!won[0]) throw new Error("You already chose.");
      await writeNotice(sql, {
        userId: context.userId,
        kind: "pickup",
        title: "Hold for pickup",
        body: "It’s still yours. Collect it at the official store with your seller code.",
        refId: order.id,
      });
      return { ok: true as const, choice: "pickup" as const };
    }

    const won = await sql<{ id: string }>`
      update orders
      set disposition = ${"abandoned"}, disposed_at = now(), released_at = coalesce(released_at, now())
      where id = ${order.id} and seller_id = ${context.userId} and disposition is null and status = ${"cancelled"}
      returning id
    `;
    if (!won[0]) throw new Error("You already chose.");
    const listingId = crypto.randomUUID();
    const price = Number(order.price_cents);
    const description = order.description.includes("Rummlee is reselling it")
      ? order.description
      : `${order.description.trim()}\n\n${LEAVE_NOTE}`.trim();
    try {
      await sql`
        insert into listings (
          id, sale_id, seller_id, title, description, price_cents, buy_now_cents, original_cents, floor_cents,
          category, condition, haul, size_label, pack, weight_lbs, neighborhood, handoff_modes, photo_url, status,
          origin, origin_order_id, charity_split
        )
        values (
          ${listingId},
          ${house.saleId},
          ${house.profileId},
          ${order.title},
          ${description},
          ${price},
          ${price},
          ${order.original_cents},
          ${price},
          ${order.category},
          ${order.condition},
          ${order.haul},
          ${order.size_label},
          ${order.pack},
          ${order.weight_lbs},
          ${house.neighborhood},
          ${"official"},
          ${order.photo_url},
          ${"live"},
          ${"abandoned"},
          ${order.id},
          ${true}
        )
      `;
      await sql`
        insert into house_stock (id, origin_order_id, listing_id, spot_id, package_no, market, status)
        values (
          ${crypto.randomUUID()},
          ${order.id},
          ${listingId},
          ${house.spotId},
          ${Number(order.package_no)},
          ${house.market},
          ${"shelf"}
        )
      `;
    } catch (error) {
      await sql`delete from house_stock where origin_order_id = ${order.id}`;
      await sql`delete from listings where origin_order_id = ${order.id}`;
      await sql`
        update orders set disposition = null, disposed_at = null, released_at = null
        where id = ${order.id} and disposition = ${"abandoned"} and seller_id = ${context.userId}
      `;
      throw error instanceof Error ? error : new Error("Could not leave this package.");
    }
    await sql`update listings set status = ${"abandoned"} where id = ${order.listing_id}`;
    await writeNotice(sql, {
      userId: context.userId,
      kind: "abandoned",
      title: "You left it",
      body: "It’s Rummlee’s to resell in Fargo. Your handle is not on the new listing. You are not paid. Half of what Rummlee receives goes to charity.",
      refId: order.id,
    });
    return { ok: true as const, choice: "abandon" as const };
  });

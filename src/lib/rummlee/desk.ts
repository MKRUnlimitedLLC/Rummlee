import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ensureProfile, optionalUserId, settleOrder } from "./server";
import { refundEscrow, writeNotice } from "./books";
import { TEST_MODE } from "./constants";
import { houseForSpot } from "./house";
import { ensureApproach } from "./approach";
import { milesFromStore, STORE_CLOSE_MILES } from "./distance";
import { grantRep } from "./rep";

export type CounterHit = {
  kind: "in" | "out" | "wait" | "done" | "refused";
  packageNo: number | null;
};

const DEVICE_KEY = "device";

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

async function counterSpot(token: string | undefined, userId: string | null) {
  const sql = await getSql();
  if (token) {
    const rows = await sql<{ id: string; spot_id: string }>`
      select id, spot_id from location_devices where secret_hash = ${hashSecret(token)} limit 1
    `;
    if (rows[0]) return { sql, spotId: rows[0].spot_id, deviceId: rows[0].id };
  }
  if (userId) {
    const me = await ensureProfile(sql, userId);
    const desk = await sql<{ desk_spot_id: string | null; is_staff: boolean }>`
      select desk_spot_id, is_staff from profiles where id = ${userId}
    `;
    if (desk[0]?.desk_spot_id) return { sql, spotId: desk[0].desk_spot_id, deviceId: null as string | null };
    if (me.isStaff) throw new Error("Pair this screen to a store before scanning.");
  }
  throw new Error("This screen isn’t a Rummlee counter.");
}

async function nextPackage(sql: Awaited<ReturnType<typeof getSql>>, spotId: string) {
  const used = await sql<{ package_no: number }>`
    select package_no from orders
    where handoff_spot_id = ${spotId} and released_at is null and package_no is not null
  `;
  const stock = await sql<{ package_no: number }>`
    select package_no from house_stock where spot_id = ${spotId} and status in (${"shelf"}, ${"held"})
  `;
  const taken = new Set([...used, ...stock].map((row) => Number(row.package_no)));
  for (let n = 1; n <= 99; n += 1) {
    if (!taken.has(n)) return n;
  }
  throw new Error("This counter is full. Hand off a package before taking another.");
}

export const scanAtCounter = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ code: z.string().min(8).max(80), deviceSecret: z.string().min(8).max(80).optional() }).parse(data),
  )
  .handler(async ({ data }): Promise<CounterHit> => {
    const userId = await optionalUserId();
    const { sql, spotId } = await counterSpot(data.deviceSecret, userId);
    const code = data.code.trim();
    const rows = await sql<{
      id: string;
      seller_scan: string | null;
      buyer_scan: string | null;
      package_no: number | null;
      handoff_spot_id: string | null;
      handoff_type: string;
      status: string;
      released_at: string | null;
      buyer_id: string;
      seller_id: string;
      disposition: string | null;
      listing_id: string;
    }>`
      select id, seller_scan, buyer_scan, package_no, handoff_spot_id, handoff_type, status, released_at,
             buyer_id, seller_id, disposition, listing_id
      from orders
      where seller_scan = ${code} or buyer_scan = ${code}
      limit 1
    `;
    const order = rows[0];
    if (!order) throw new Error("That code isn’t a Rummlee handoff.");
    if (order.handoff_type !== "official" || order.handoff_spot_id !== spotId) {
      throw new Error("Wrong counter. This sale belongs at another handoff location.");
    }
    const side = order.seller_scan === code ? "seller" : "buyer";
    if (side === "seller") {
      if (order.disposition === "abandoned") {
        throw new Error("This package was left with Rummlee. Don’t hand it back.");
      }
      if (order.status === "cancelled" && !order.disposition && order.package_no != null && !order.released_at) {
        throw new Error("The seller hasn’t chosen hold for pickup or leave it. The package stays.");
      }
      if (order.status === "cancelled" && order.disposition === "pickup" && order.package_no != null && !order.released_at) {
        await sql`update orders set released_at = now() where id = ${order.id} and released_at is null`;
        await sql`update listings set status = ${"live"} where id = ${order.listing_id} and status = ${"held"}`;
        return { kind: "out", packageNo: Number(order.package_no) };
      }
      if (order.released_at || order.status === "picked_up") {
        return { kind: "done", packageNo: order.package_no == null ? null : Number(order.package_no) };
      }
      if (order.package_no != null) return { kind: "in", packageNo: Number(order.package_no) };
      const packageNo = await nextPackage(sql, spotId);
      await sql`
        update orders
        set package_no = ${packageNo}, checked_in_at = now()
        where id = ${order.id} and package_no is null
      `;
      await writeNotice(sql, {
        userId: order.buyer_id,
        kind: "ready",
        title: "Your package is at the official store",
        body: "The counter has it. Bring your buyer code. They will not say your name, and this note does not include the package number.",
        refId: order.id,
      });
      return { kind: "in", packageNo };
    }
    if (order.package_no == null) return { kind: "wait", packageNo: null };
    const released = await sql<{ package_no: number }>`
      update orders set released_at = now()
      where id = ${order.id} and released_at is null and status = ${"escrow"} and package_no is not null
      returning package_no
    `;
    if (!released[0]) return { kind: "done", packageNo: Number(order.package_no) };
    await settleOrder(sql, order.id);
    return { kind: "out", packageNo: Number(released[0].package_no) };
  });

export const refuseAtCounter = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ code: z.string().min(8).max(80), deviceSecret: z.string().min(8).max(80).optional() }).parse(data),
  )
  .handler(async ({ data }): Promise<CounterHit> => {
    const userId = await optionalUserId();
    const { sql, spotId } = await counterSpot(data.deviceSecret, userId);
    const code = data.code.trim();
    const rows = await sql<{
      id: string;
      seller_id: string;
      buyer_id: string;
      package_no: number | null;
      handoff_spot_id: string | null;
      handoff_type: string;
      status: string;
      released_at: string | null;
    }>`
      select id, seller_id, buyer_id, package_no, handoff_spot_id, handoff_type, status, released_at
      from orders
      where seller_scan = ${code} or buyer_scan = ${code}
      limit 1
    `;
    const order = rows[0];
    if (!order) throw new Error("That code isn’t a Rummlee handoff.");
    if (order.handoff_type !== "official" || order.handoff_spot_id !== spotId) {
      throw new Error("Wrong counter. This sale belongs at another handoff location.");
    }
    if (order.released_at || order.status !== "escrow") throw new Error("This package already left the counter.");
    const packageNo = order.package_no == null ? null : Number(order.package_no);
    const refunded = await refundEscrow(sql, order.id, "Counter refused the package");
    if (!refunded) throw new Error("Could not refuse this package.");
    await writeNotice(sql, {
      userId: order.seller_id,
      kind: "refused",
      title: "Counter did not complete the handoff",
      body: packageNo && houseForSpot(order.handoff_spot_id)
        ? "The package is still at the Fargo official store. In your inbox, hold it for pickup or leave it. Leave it and it becomes Rummlee’s to resell. The buyer was refunded."
        : packageNo
          ? "The package is still at the store. Pick it up with your seller code. The buyer was refunded."
          : "The counter did not take the package. The buyer was refunded and the listing is live again.",
      refId: order.id,
    });
    await writeNotice(sql, {
      userId: order.buyer_id,
      kind: "refund",
      title: "Handoff refused",
      body: TEST_MODE
        ? "The counter sent the package back. Test credits are in your wallet. Not real money."
        : "The counter sent the package back. The payment was returned.",
      refId: order.id,
    });
    return { kind: "refused", packageNo };
  });

export const getCounterHome = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ deviceSecret: z.string().optional() }).parse(data ?? {}))
  .handler(async ({ data }) => {
    const userId = await optionalUserId();
    try {
      const { sql, spotId, deviceId } = await counterSpot(data.deviceSecret, userId);
      await ensureApproach(sql);
      const spot = await sql<{ name: string; area: string }>`select name, area from handoff_spots where id = ${spotId}`;
      const holding = await sql<{ n: number }>`
        select count(*)::int as n from orders
        where handoff_spot_id = ${spotId} and package_no is not null and released_at is null and status = 'escrow'
      `;
      const coming = await sql<{ package_no: number | null; role: string; phase: string | null }>`
        select o.package_no, p.role, p.phase
        from approach_pings p
        join orders o on o.id = p.order_id
        where p.spot_id = ${spotId}
          and (
            (coalesce(p.phase, 'close') = 'way' and p.created_at > now() - interval '2 hours')
            or (coalesce(p.phase, 'close') <> 'way' and p.created_at > now() - interval '20 minutes')
          )
        order by p.created_at desc
        limit 8
      `;
      const marks = await sql<{ up: number; n: number }>`
        select count(*) filter (where ready = 'up')::int as up, count(*)::int as n
        from spot_marks where spot_id = ${spotId}
      `;
      return {
        ready: true as const,
        spotName: spot[0]?.name ?? "Counter",
        area: spot[0]?.area ?? "",
        holding: Number(holding[0]?.n ?? 0),
        paired: Boolean(deviceId),
        approaching: coming.map((row) => {
          const close = row.phase !== "way";
          const tag = row.package_no != null ? ` · tag ${row.package_no}` : "";
          if (row.role === "buyer") return close ? `Pickup close${tag}` : `Pickup on the way${tag}`;
          return close ? `Drop-off close${tag}` : `Drop-off on the way${tag}`;
        }),
        storeReady: Number(marks[0]?.n ?? 0) > 0 ? `${marks[0]?.up ?? 0}/${marks[0]?.n ?? 0} say the counter was ready` : null,
      };
    } catch {
      return { ready: false as const, spotName: "", area: "", holding: 0, paired: false, approaching: [] as string[], storeReady: null as string | null };
    }
  });

export const pairCounter = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ spotId: z.string(), label: z.string().min(2).max(40) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfile(sql, context.userId);
    if (!me.isStaff) throw new Error("Only corporate can pair a counter.");
    const spot = await sql<{ id: string; name: string }>`select id, name from handoff_spots where id = ${data.spotId} and kind = ${"partner"}`;
    if (!spot[0]) throw new Error("Pick an official store.");
    const secret = `RUMC${randomBytes(12).toString("hex")}`;
    await sql`
      insert into location_devices (id, spot_id, label, secret_hash)
      values (${crypto.randomUUID()}, ${spot[0].id}, ${data.label.trim()}, ${hashSecret(secret)})
    `;
    return { secret, spotName: spot[0].name };
  });

export const assignDesk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ handle: z.string().min(2).max(40), spotId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfile(sql, context.userId);
    if (!me.isStaff) throw new Error("Only corporate can assign a counter login.");
    const handle = data.handle.replace(/^@/, "").trim().toLowerCase();
    const person = await sql<{ id: string }>`select id from profiles where lower(handle) = ${handle} limit 1`;
    if (!person[0]) throw new Error("No handle by that name.");
    const spot = await sql<{ id: string }>`select id from handoff_spots where id = ${data.spotId} and kind = ${"partner"}`;
    if (!spot[0]) throw new Error("Pick an official store.");
    await sql`update profiles set desk_spot_id = ${spot[0].id} where id = ${person[0].id}`;
    return { ok: true as const };
  });

export const listPartnerSpots = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = await ensureProfile(sql, context.userId);
    if (!me.isStaff) return [];
    return sql<{ id: string; name: string; area: string }>`
      select id, name, area from handoff_spots where kind = ${"partner"} order by name
    `;
  });

export const pingApproaching = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ orderId: z.string().min(2), lat: z.number(), lng: z.number() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureApproach(sql);
    const rows = await sql<{
      id: string;
      buyer_id: string;
      seller_id: string;
      status: string;
      handoff_type: string;
      spot_id: string | null;
    }>`
      select id, buyer_id, seller_id, status, handoff_type, handoff_spot_id as spot_id
      from orders where id = ${data.orderId}
    `;
    const order = rows[0];
    if (!order) throw new Error("Pickup not found.");
    if (order.handoff_type !== "official" || !order.spot_id) throw new Error("Only an official partner store gets this.");
    if (order.status !== "escrow") throw new Error("This handoff isn’t on the way.");
    const role = order.buyer_id === context.userId ? "buyer" : order.seller_id === context.userId ? "seller" : null;
    if (!role) throw new Error("Not your handoff.");
    const miles = milesFromStore(order.spot_id, data.lat, data.lng);
    if (miles == null || miles > STORE_CLOSE_MILES) throw new Error("Not close enough yet. The store is told only when you’re nearby.");
    await sql`delete from approach_pings where order_id = ${order.id} and role = ${role}`;
    await sql`
      insert into approach_pings (id, order_id, spot_id, role, phase)
      values (${crypto.randomUUID()}, ${order.id}, ${order.spot_id}, ${role}, ${"close"})
    `;
    return { told: true as const };
  });

export const onMyWay = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ orderId: z.string().min(2) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureApproach(sql);
    const rows = await sql<{
      id: string;
      buyer_id: string;
      seller_id: string;
      status: string;
      handoff_type: string;
      spot_id: string | null;
    }>`
      select id, buyer_id, seller_id, status, handoff_type, handoff_spot_id as spot_id
      from orders where id = ${data.orderId}
    `;
    const order = rows[0];
    if (!order) throw new Error("Pickup not found.");
    if (order.status !== "escrow") throw new Error("This handoff isn’t open.");
    const role = order.buyer_id === context.userId ? "buyer" : order.seller_id === context.userId ? "seller" : null;
    if (!role) throw new Error("Not your handoff.");
    const otherId = role === "buyer" ? order.seller_id : order.buyer_id;
    const recent = await sql<{ id: string }>`
      select id from notices
      where user_id = ${otherId} and ref_id = ${order.id} and kind = ${"on_way"}
        and created_at > now() - interval '30 minutes'
      limit 1
    `;
    if (order.handoff_type === "official" && order.spot_id) {
      const ping = await sql<{ phase: string }>`
        select phase from approach_pings where order_id = ${order.id} and role = ${role}
      `;
      if (ping[0]?.phase !== "close") {
        await sql`delete from approach_pings where order_id = ${order.id} and role = ${role}`;
        await sql`
          insert into approach_pings (id, order_id, spot_id, role, phase)
          values (${crypto.randomUUID()}, ${order.id}, ${order.spot_id}, ${role}, ${"way"})
        `;
      }
    }
    if (recent[0]) return { told: true as const, already: true as const };
    const who = await sql<{ handle: string }>`select handle from profiles where id = ${context.userId}`;
    const handle = who[0]?.handle ?? "Someone";
    const toStore = order.handoff_type === "official";
    await writeNotice(sql, {
      userId: otherId,
      kind: "on_way",
      title: "On the way",
      body: toStore
        ? `@${handle} is on the way to the official partner store. No location was sent.`
        : `@${handle} is on the way to the handoff. No location was sent.`,
      refId: order.id,
    });
    return { told: true as const, already: false as const, store: toStore };
  });

export const rateAtCounter = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        code: z.string().min(8).max(80),
        ready: z.enum(["up", "down"]),
        deviceSecret: z.string().min(8).max(80).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const userId = await optionalUserId();
    const { sql, spotId } = await counterSpot(data.deviceSecret, userId);
    await ensureApproach(sql);
    const code = data.code.trim();
    const rows = await sql<{ id: string; seller_scan: string | null; buyer_scan: string | null; seller_id: string; buyer_id: string }>`
      select id, seller_scan, buyer_scan, seller_id, buyer_id from orders
      where handoff_spot_id = ${spotId} and (seller_scan = ${code} or buyer_scan = ${code})
      limit 1
    `;
    const order = rows[0];
    if (!order) throw new Error("That code isn’t at this counter.");
    const side = order.seller_scan === code ? "dropoff" : "pickup";
    const subjectId = side === "dropoff" ? order.seller_id : order.buyer_id;
    const existing = await sql<{ id: string }>`select id from counter_marks where order_id = ${order.id} and side = ${side}`;
    if (existing[0]) return { ok: true as const };
    await sql`
      insert into counter_marks (id, order_id, spot_id, subject_id, side, ready)
      values (${crypto.randomUUID()}, ${order.id}, ${spotId}, ${subjectId}, ${side}, ${data.ready})
    `;
    if (data.ready === "up") await grantRep(sql, subjectId, "on_time", 2, `${order.id}:${side}`);
    return { ok: true as const };
  });

export { DEVICE_KEY };

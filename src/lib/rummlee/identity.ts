import { createHash } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { IDENTITY_CAP, IDENTITY_ENABLED } from "./constants";

type Sql = Awaited<ReturnType<typeof import("@/lib/db").getSql>>;

/** Compare the private account name to the name Stripe read off the ID. First token and last token. */
export function identityNamesMatch(
  accountFirst: string | null | undefined,
  accountLast: string | null | undefined,
  idFirst: string | null | undefined,
  idLast: string | null | undefined,
) {
  const tokens = (value: string | null | undefined) =>
    (value ?? "")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);
  const aFirst = tokens(accountFirst);
  const aLast = tokens(accountLast);
  const bFirst = tokens(idFirst);
  const bLast = tokens(idLast);
  if (!aFirst.length || !aLast.length || !bFirst.length || !bLast.length) return false;
  return aFirst[0] === bFirst[0] && aLast[aLast.length - 1] === bLast[bLast.length - 1];
}

export async function verifiedIdentityCount(sql: Sql) {
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from identity_checks where provider = ${"stripe"} and status = ${"verified"}
  `;
  return Number(rows[0]?.n ?? 0);
}

function siteOrigin() {
  try {
    const request = getRequest();
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`;
  } catch {
    /* no request scope */
  }
  return process.env.APP_ORIGIN ?? "https://rummlee.com";
}

function govFingerprint(country: string | null, type: string | null, number: string | null) {
  if (!number) return null;
  return createHash("sha256")
    .update(`gov:${country ?? ""}:${type ?? ""}:${number}`)
    .digest("hex");
}

async function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe Identity is not configured.");
  const { default: Stripe } = await import("stripe");
  return new Stripe(key);
}

/** Opens a Stripe-hosted ID check. Does not store the photo. Refuses while the beta switch is off or the cap is full. */
export async function beginIdentity(sql: Sql, profileId: string) {
  if (!IDENTITY_ENABLED) throw new Error("ID checks are off during beta.");
  const used = await verifiedIdentityCount(sql);
  if (used >= IDENTITY_CAP) throw new Error("ID checks are paused. The cap of 50 has been reached.");
  const stripe = await stripeClient();
  const session = await stripe.identity.verificationSessions.create({
    type: "document",
    metadata: { profile_id: profileId },
    options: { document: { require_matching_selfie: true, require_live_capture: true } },
    return_url: `${siteOrigin()}/you?identity=return`,
  });
  await sql`
    insert into identity_checks (id, profile_id, provider, session_id, status)
    values (${crypto.randomUUID()}, ${profileId}, ${"stripe"}, ${session.id}, ${"started"})
  `;
  if (!session.url) throw new Error("Stripe did not return a check link.");
  return { url: session.url, sessionId: session.id };
}

export type IdentityFinish =
  | { outcome: "verified"; govFingerprint: string | null; sessionId: string }
  | { outcome: "mismatch"; sessionId: string }
  | { outcome: "pending"; sessionId: string }
  | { outcome: "failed"; sessionId: string | null };

/** Pulls only the name (and a hash of the document number, if Stripe sent one). Never returns the ID photo or the number. */
export async function finishIdentity(sql: Sql, profileId: string, sessionId?: string): Promise<IdentityFinish> {
  if (!IDENTITY_ENABLED) throw new Error("ID checks are off during beta.");
  const open = sessionId
    ? await sql<{ session_id: string }>`
        select session_id from identity_checks
        where profile_id = ${profileId} and provider = ${"stripe"} and session_id = ${sessionId}
        limit 1
      `
    : await sql<{ session_id: string }>`
        select session_id from identity_checks
        where profile_id = ${profileId} and provider = ${"stripe"} and status = ${"started"}
        order by created_at desc
        limit 1
      `;
  const id = open[0]?.session_id;
  if (!id) return { outcome: "failed", sessionId: null };
  const stripe = await stripeClient();
  const session = await stripe.identity.verificationSessions.retrieve(id, {
    expand: ["last_verification_report"],
  });
  if (session.metadata?.profile_id && session.metadata.profile_id !== profileId) {
    return { outcome: "failed", sessionId: id };
  }
  if (session.status === "processing" || session.status === "requires_input") {
    return { outcome: "pending", sessionId: id };
  }
  if (session.status !== "verified") {
    await sql`update identity_checks set status = ${"failed"} where session_id = ${id} and status = ${"started"}`;
    return { outcome: "failed", sessionId: id };
  }
  const outputs = session.verified_outputs;
  const account = await sql<{ legal_first_name: string | null; legal_last_name: string | null }>`
    select legal_first_name, legal_last_name from profiles where id = ${profileId}
  `;
  const mine = account[0];
  const matched = identityNamesMatch(
    mine?.legal_first_name,
    mine?.legal_last_name,
    outputs?.first_name,
    outputs?.last_name,
  );
  if (!matched) {
    await sql`update identity_checks set status = ${"name_mismatch"} where session_id = ${id} and status = ${"started"}`;
    return { outcome: "mismatch", sessionId: id };
  }
  const report = session.last_verification_report;
  const document = report && typeof report === "object" ? report.document : null;
  const fingerprint = govFingerprint(document?.issuing_country ?? null, document?.type ?? null, document?.number ?? null);
  return { outcome: "verified", govFingerprint: fingerprint, sessionId: id };
}

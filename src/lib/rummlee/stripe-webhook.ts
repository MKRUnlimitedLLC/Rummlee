import type Stripe from "stripe";
import { getSql } from "@/lib/db";
import { IDENTITY_ENABLED } from "./constants";
import { completeIdentitySession } from "./server";

/** Stripe signs the raw body. Identity stays off during beta: a valid event is acknowledged and ignored. */
export async function handleStripeWebhook(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) return new Response("Stripe webhook is not configured.", { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature.", { status: 400 });
  const payload = await request.text();
  const { default: StripeSdk } = await import("stripe");
  const stripe = new StripeSdk(key);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return new Response("Bad signature.", { status: 400 });
  }
  if (!event.type.startsWith("identity.verification_session.")) {
    return Response.json({ received: true });
  }
  if (!IDENTITY_ENABLED) return Response.json({ received: true, ignored: true });
  const session = event.data.object as Stripe.Identity.VerificationSession;
  if (event.type === "identity.verification_session.canceled") {
    const sql = await getSql();
    await sql`
      update identity_checks set status = ${"canceled"}
      where session_id = ${session.id} and provider = ${"stripe"} and status = ${"started"}
    `;
    return Response.json({ received: true });
  }
  if (event.type !== "identity.verification_session.verified") {
    return Response.json({ received: true });
  }
  const sql = await getSql();
  const row = await sql<{ profile_id: string; status: string }>`
    select profile_id, status from identity_checks where session_id = ${session.id} and provider = ${"stripe"} limit 1
  `;
  if (!row[0]) return Response.json({ received: true });
  if (row[0].status === "verified" || row[0].status === "name_mismatch" || row[0].status === "id_in_use") {
    return Response.json({ received: true });
  }
  try {
    await completeIdentitySession(row[0].profile_id, session.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("does not match") || message.includes("already has a live account") || message.includes("cap of 50")) {
      return Response.json({ received: true });
    }
    if (message.includes("still running")) return new Response("Still processing.", { status: 500 });
    return new Response("Not applied.", { status: 500 });
  }
  return Response.json({ received: true });
}

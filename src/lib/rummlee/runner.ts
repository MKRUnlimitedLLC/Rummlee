import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { CHECKR_ENABLED, RUNNERS_ENABLED, RUNNER_WEEKLY_CAP } from "./constants";
import {
  CHECKR_OFF,
  RUNNERS_OFF,
  runnerRepayCents,
  runnerStep,
  RUNNER_CITIES,
  type CheckMark,
  type RunnerVehicle,
} from "./runner-policy";

type Sql = Awaited<ReturnType<typeof getSql>>;

async function ensureRunnerTable(sql: Sql) {
  await sql`
    create table if not exists runners (
      profile_id text primary key,
      city text not null,
      license_state text not null,
      vehicle text not null,
      range_miles integer not null,
      small_per_mile_cents integer not null,
      big_per_mile_cents integer not null,
      insurance_shown boolean not null default false,
      payout_noted boolean not null default false,
      attested boolean not null default false,
      consented boolean not null default false,
      minnesota boolean not null default false,
      repay_cents integer not null default 0,
      repay_left_cents integer not null default 0,
      status text not null,
      mvr text not null default 'none',
      criminal text not null default 'none',
      checkr_id text,
      failed_at timestamptz,
      updated_at timestamptz not null default now()
    )
  `;
}

const draftInput = z.object({
  age: z.number().int().min(18).max(100),
  licenseYears: z.number().int().min(0).max(80),
  city: z.enum(RUNNER_CITIES),
  licenseState: z.string().length(2),
  vehicle: z.enum(["car", "truck", "both"]),
  rangeMiles: z.number().int().min(1).max(100),
  smallPerMileCents: z.number().int().min(1).max(5000),
  bigPerMileCents: z.number().int().min(1).max(10000),
  insuranceShown: z.boolean(),
  payoutNoted: z.boolean(),
  attested: z.boolean(),
  consented: z.boolean(),
});

function offDesk() {
  return {
    enabled: false as const,
    checkr: false as const,
    weeklyCap: RUNNER_WEEKLY_CAP,
    application: null,
  };
}

export const getRunnerDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!RUNNERS_ENABLED) return offDesk();
    const sql = await getSql();
    await ensureRunnerTable(sql);
    const rows = await sql<{
      city: string;
      license_state: string;
      vehicle: string;
      range_miles: number;
      small_per_mile_cents: number;
      big_per_mile_cents: number;
      insurance_shown: boolean;
      payout_noted: boolean;
      attested: boolean;
      consented: boolean;
      minnesota: boolean;
      repay_cents: number;
      repay_left_cents: number;
      status: string;
      mvr: string;
      criminal: string;
    }>`
      select city, license_state, vehicle, range_miles, small_per_mile_cents, big_per_mile_cents,
             insurance_shown, payout_noted, attested, consented, minnesota, repay_cents, repay_left_cents,
             status, mvr, criminal
      from runners where profile_id = ${context.userId}
    `;
    return {
      enabled: true as const,
      checkr: CHECKR_ENABLED,
      weeklyCap: RUNNER_WEEKLY_CAP,
      application: rows[0]
        ? {
            city: rows[0].city,
            licenseState: rows[0].license_state,
            vehicle: rows[0].vehicle as RunnerVehicle,
            rangeMiles: rows[0].range_miles,
            smallPerMileCents: rows[0].small_per_mile_cents,
            bigPerMileCents: rows[0].big_per_mile_cents,
            insuranceShown: rows[0].insurance_shown,
            payoutNoted: rows[0].payout_noted,
            attested: rows[0].attested,
            consented: rows[0].consented,
            minnesota: rows[0].minnesota,
            repayCents: rows[0].repay_cents,
            repayLeftCents: rows[0].repay_left_cents,
            status: rows[0].status,
            mvr: rows[0].mvr as CheckMark,
            criminal: rows[0].criminal as CheckMark,
          }
        : null,
    };
  });

export const saveRunnerDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => draftInput.parse(data))
  .handler(async ({ context, data }) => {
    if (!RUNNERS_ENABLED) throw new Error(RUNNERS_OFF);
    const decision = runnerStep({
      runnersEnabled: true,
      checkrEnabled: CHECKR_ENABLED,
      age: data.age,
      licenseYears: data.licenseYears,
      city: data.city,
      licenseState: data.licenseState.toUpperCase(),
      vehicle: data.vehicle,
      rangeMiles: data.rangeMiles,
      smallPerMileCents: data.smallPerMileCents,
      bigPerMileCents: data.bigPerMileCents,
      insuranceShown: data.insuranceShown,
      payoutNoted: data.payoutNoted,
      attested: data.attested,
      consented: data.consented,
      hasJobInRange: false,
      orderedThisWeek: 0,
      weeklyCap: RUNNER_WEEKLY_CAP,
      mvr: "none",
      criminal: "none",
      failedAt: null,
      now: Date.now(),
    });
    if (decision.step === "mvr" || decision.step === "criminal") throw new Error(CHECKR_OFF);
    const sql = await getSql();
    await ensureRunnerTable(sql);
    const state = data.licenseState.toUpperCase();
    const repay = runnerRepayCents(data.city, state);
    await sql`
      insert into runners (
        profile_id, city, license_state, vehicle, range_miles, small_per_mile_cents, big_per_mile_cents,
        insurance_shown, payout_noted, attested, consented, minnesota, repay_cents, repay_left_cents, status
      ) values (
        ${context.userId}, ${data.city}, ${state}, ${data.vehicle}, ${data.rangeMiles},
        ${data.smallPerMileCents}, ${data.bigPerMileCents}, ${data.insuranceShown}, ${data.payoutNoted},
        ${data.attested}, ${data.consented}, ${repay === 0}, ${repay}, ${repay}, ${decision.step}
      )
      on conflict (profile_id) do update set
        city = excluded.city,
        license_state = excluded.license_state,
        vehicle = excluded.vehicle,
        range_miles = excluded.range_miles,
        small_per_mile_cents = excluded.small_per_mile_cents,
        big_per_mile_cents = excluded.big_per_mile_cents,
        insurance_shown = excluded.insurance_shown,
        payout_noted = excluded.payout_noted,
        attested = excluded.attested,
        consented = excluded.consented,
        minnesota = excluded.minnesota,
        repay_cents = excluded.repay_cents,
        repay_left_cents = case when runners.mvr = 'clear' and runners.criminal = 'clear' then runners.repay_left_cents else excluded.repay_cents end,
        status = excluded.status,
        updated_at = now()
    `;
    return { status: decision.step, reason: decision.reason, repayCents: repay };
  });

export const orderRunnerCheck = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => {
    if (!RUNNERS_ENABLED) throw new Error(RUNNERS_OFF);
    throw new Error(CHECKR_OFF);
  });

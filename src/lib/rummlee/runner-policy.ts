/** First mile pay that repays a passed check. Not Lux revenue. Minnesota is zero. */
export const RUNNER_REPAY_CENTS = 8500;
export const RUNNER_MIN_AGE = 21;
export const RUNNER_MIN_LICENSE_YEARS = 2;
export const RUNNER_RETRY_MS = 365 * 24 * 60 * 60 * 1000;

export const RUNNERS_OFF = "Runner signup is off. No check is ordered and no one is paid.";
export const CHECKR_OFF = "Checkr is not connected. No check is ordered.";
export const RUNNER_STANDARD =
  "Automatic no: no valid license, under 21, licensed less than two years, a DUI in the last seven years, or a conviction for violence, a sex offense, burglary, robbery, or theft.";

export const RUNNER_CITIES = ["Fargo", "Moorhead", "Minneapolis"] as const;
export type RunnerCity = (typeof RUNNER_CITIES)[number];
export type RunnerVehicle = "car" | "truck" | "both";
export type CheckMark = "none" | "clear" | "fail" | "review";

const MINNESOTA_CITY = /moorhead|minneapolis|minnesota/i;

export function isMinnesotaRunner(city: string, licenseState: string) {
  if (licenseState.trim().toUpperCase() === "MN") return true;
  return MINNESOTA_CITY.test(city);
}

export function runnerRepayCents(city: string, licenseState: string) {
  return isMinnesotaRunner(city, licenseState) ? 0 : RUNNER_REPAY_CENTS;
}

/** Quoted miles times the runner’s rate. A trip past their range is not a job. */
export function mileQuote(miles: number, perMileCents: number, rangeMiles: number) {
  if (!Number.isInteger(miles) || miles < 1) return null;
  if (!Number.isInteger(rangeMiles) || rangeMiles < 1) return null;
  if (!Number.isInteger(perMileCents) || perMileCents < 1) return null;
  if (miles > rangeMiles) return null;
  return miles * perMileCents;
}

export function takeRepayment(earnedCents: number, leftCents: number) {
  const earned = Math.max(0, earnedCents);
  const left = Math.max(0, leftCents);
  const take = Math.min(earned, left);
  return { take, paidCents: earned - take, leftCents: left - take };
}

export type RunnerGateInput = {
  runnersEnabled: boolean;
  checkrEnabled: boolean;
  age: number;
  licenseYears: number;
  city: string;
  licenseState: string;
  vehicle: RunnerVehicle | "";
  rangeMiles: number;
  smallPerMileCents: number;
  bigPerMileCents: number;
  insuranceShown: boolean;
  payoutNoted: boolean;
  attested: boolean;
  consented: boolean;
  hasJobInRange: boolean;
  orderedThisWeek: number;
  weeklyCap: number;
  mvr: CheckMark;
  criminal: CheckMark;
  failedAt: number | null;
  now: number;
};

export type RunnerStep = "off" | "draft" | "waiting" | "mvr" | "criminal" | "review" | "checked" | "failed";

export function runnerStep(input: RunnerGateInput): { step: RunnerStep; reason: string } {
  if (!input.runnersEnabled) return { step: "off", reason: RUNNERS_OFF };
  if (input.failedAt != null && input.now < input.failedAt + RUNNER_RETRY_MS && (input.mvr === "fail" || input.criminal === "fail")) {
    return { step: "failed", reason: "This check did not pass. You owe nothing. You can try again in a year." };
  }
  if (input.mvr === "clear" && input.criminal === "clear") {
    return { step: "checked", reason: "Runner checked." };
  }
  if (input.criminal === "review") {
    return { step: "review", reason: "A person is reading this one report." };
  }
  const ready =
    input.age >= RUNNER_MIN_AGE &&
    input.licenseYears >= RUNNER_MIN_LICENSE_YEARS &&
    (RUNNER_CITIES as readonly string[]).includes(input.city) &&
    /^[A-Z]{2}$/.test(input.licenseState.trim().toUpperCase()) &&
    (input.vehicle === "car" || input.vehicle === "truck" || input.vehicle === "both") &&
    input.rangeMiles >= 1 &&
    input.smallPerMileCents >= 1 &&
    input.bigPerMileCents >= 1 &&
    input.insuranceShown &&
    input.payoutNoted &&
    input.attested &&
    input.consented;
  if (!ready) return { step: "draft", reason: "Finish every step before a check can be ordered." };
  if (!input.hasJobInRange) return { step: "waiting", reason: "No Lux job in your range yet." };
  if (input.orderedThisWeek >= input.weeklyCap) return { step: "waiting", reason: "The weekly check cap is full." };
  if (!input.checkrEnabled) return { step: "waiting", reason: CHECKR_OFF };
  if (input.mvr !== "clear") return { step: "mvr", reason: "The driving record runs first." };
  return { step: "criminal", reason: "The criminal search runs only after the driving record is clear." };
}

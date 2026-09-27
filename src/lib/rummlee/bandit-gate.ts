import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Vercel env Matthew sets. Unset or blank keeps /bandit locked. */
export const BANDIT_ACCESS_ENV = "BANDIT_ACCESS_CODE";

const TOKEN_LABEL = "rummlee-bandit-gate-v1";

export function banditAccessCode(env: NodeJS.ProcessEnv = process.env): string {
  return env[BANDIT_ACCESS_ENV]?.trim() ?? "";
}

export function banditCodesMatch(given: string, expected: string): boolean {
  if (!expected || !given.trim()) return false;
  const a = createHash("sha256").update(given.trim()).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function banditGateToken(code: string): string {
  return createHmac("sha256", code).update(TOKEN_LABEL).digest("hex");
}

export function banditTokenMatches(got: string | undefined, code: string): boolean {
  if (!code || !got) return false;
  const expected = banditGateToken(code);
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

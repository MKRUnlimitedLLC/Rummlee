import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Server only. Not imported by the browser bundle. Change this line to change the code. */
const CODE = "Kite-4419";

export const BANDIT_COOKIE = "rummlee_bandit";

export function codeMatches(input: string): boolean {
  const a = createHash("sha256").update(CODE, "utf8").digest();
  const b = createHash("sha256").update(input.trim(), "utf8").digest();
  return timingSafeEqual(a, b);
}

export function sessionToken(): string {
  return createHmac("sha256", CODE).update("rummlee-bandit-v1").digest("hex");
}

export function sessionOk(value: string | undefined): boolean {
  if (!value) return false;
  const expected = Buffer.from(sessionToken());
  const got = Buffer.from(value);
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}

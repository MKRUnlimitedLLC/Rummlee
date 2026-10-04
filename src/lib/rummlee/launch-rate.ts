/** A person can submit the waitlist and a store application, plus a few retries. */
export const LAUNCH_RATE_PER_HOUR = 10;
export const LAUNCH_RATE_PER_DAY = 30;

export function launchRateAllows(hourCount: number, dayCount: number) {
  return hourCount < LAUNCH_RATE_PER_HOUR && dayCount < LAUNCH_RATE_PER_DAY;
}

function isIp(value: string) {
  if (!value || value.length > 64) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return true;
  return /^[0-9a-fA-F:]+$/.test(value) && value.includes(":") && /\d/.test(value);
}

/**
 * Prefer the platform client address. `x-real-ip` is set by the host.
 * A caller-supplied forwarded list is not used once that address is present,
 * so rotating it does not open a new budget.
 */
export function clientAddress(headers: { get(name: string): string | null }) {
  const real = headers.get("x-real-ip")?.trim() ?? "";
  if (isIp(real)) return real;
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) {
    const first = vercel.split(",")[0]?.trim() ?? "";
    if (isIp(first)) return first;
  }
  return null;
}

/** Stable short hash. The raw address is not stored. Uses web crypto so the module can load in the browser. */
export async function clientKeyFromHeaders(headers: { get(name: string): string | null }) {
  const address = clientAddress(headers);
  if (!address) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`rummlee-launch:${address}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

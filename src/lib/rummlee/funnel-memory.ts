const KEY = "rummlee.funnel";

export const FUNNEL_ONCE = ["started", "photo", "price"] as const;
export type FunnelOnce = (typeof FUNNEL_ONCE)[number];

function read(storage: Storage): string[] {
  try {
    const raw = storage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((step) => typeof step === "string") : [];
  } catch {
    return [];
  }
}

/** Returns true the first time this step is seen in this storage. */
export function rememberFunnelStep(step: FunnelOnce, storage: Storage) {
  const seen = read(storage);
  if (seen.includes(step)) return false;
  storage.setItem(KEY, JSON.stringify([...seen, step]));
  return true;
}

export function forgetFunnelStep(step: FunnelOnce, storage: Storage) {
  const seen = read(storage).filter((item) => item !== step);
  storage.setItem(KEY, JSON.stringify(seen));
}

export function resetFunnelMemory(storage: Storage) {
  storage.removeItem(KEY);
}

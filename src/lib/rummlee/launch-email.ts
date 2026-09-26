const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lowercase a real address. Empty, too long, or missing a dot returns null. */
export function normalizeLaunchEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;
  if (!EMAIL.test(email)) return null;
  return email;
}

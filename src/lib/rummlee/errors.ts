export function errMessage(e: unknown) {
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong. Try again.";
}

export function isUnauthorized(e: unknown) {
  return e instanceof Error && /unauthorized/i.test(e.message);
}

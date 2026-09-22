export function errMessage(e: unknown) {
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong. Try again.";
}

export function isUnauthorized(e: unknown) {
  const msg = errMessage(e);
  return /unauthorized|not signed in|sign in required/i.test(msg);
}

const OFF_APP = [
  /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i,
  /\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b/,
  /\b\d{10,}\b/,
  /https?:\/\/|www\./i,
  /\b(?:facebook|messenger|fb|instagram|insta|whatsapp|telegram|snapchat|venmo|cash\s?app|paypal|zelle|tiktok|discord)\b/i,
  /\b(?:text|call|dm|message)\s+me\b/i,
  /\bmy\s+(?:number|cell|phone|email)\b/i,
  /\b\d{1,6}\s+[a-z0-9.'-]+\s+(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|ct|court)\b/i,
];

/** Reject a note that tries to move the conversation out of Rummlee. */
export function offAppContact(body: string) {
  return OFF_APP.some((pattern) => pattern.test(body));
}

export function assertStaysInApp(body: string) {
  if (offAppContact(body)) {
    throw new Error("Keep it in Rummlee. Don’t send a phone, email, address, or another app.");
  }
}

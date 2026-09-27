import { BANDIT_COOKIE, sessionOk } from "../../src/lib/rummlee/bandit-gate.server";
import deckTricia from "../bandit-private/rummlee-tricia.html?raw";
import deckBriefing from "../bandit-private/tricia-rummlee-briefing.html?raw";
import companionGrok from "../bandit-private/TRICIA-GROK-COMPANION.txt?raw";
import companionRummlee from "../bandit-private/TRICIA-RUMMLEE-COMPANION.txt?raw";

const FILES: Record<string, { body: string; type: string }> = {
  "/bandit/rummlee-tricia.html": { body: deckTricia, type: "text/html; charset=utf-8" },
  "/bandit/tricia-rummlee-briefing.html": { body: deckBriefing, type: "text/html; charset=utf-8" },
  "/bandit/TRICIA-GROK-COMPANION.txt": { body: companionGrok, type: "text/plain; charset=utf-8" },
  "/bandit/TRICIA-RUMMLEE-COMPANION.txt": { body: companionRummlee, type: "text/plain; charset=utf-8" },
};

interface GateEvent {
  url: URL;
  req: { method?: string; headers: Headers };
}

function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function denied(status: number, text: string): Response {
  return new Response(text, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export default function banditGate(event: GateEvent, next: () => unknown): unknown {
  const path = event.url.pathname;
  if (!path.startsWith("/bandit/")) return next();
  const file = FILES[path];
  if (!file) return denied(404, "Not found.");
  if ((event.req.method ?? "GET").toUpperCase() !== "GET") return denied(405, "Not allowed.");
  const open = sessionOk(cookieValue(event.req.headers.get("cookie"), BANDIT_COOKIE));
  if (!open) return denied(401, "Code required.");
  return new Response(file.body, {
    status: 200,
    headers: {
      "content-type": file.type,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

import { rewriteBanditHead } from "../../scripts/bandit-head.mjs";

interface BanditHeadEvent {
  url: URL;
  req: { method?: string };
}

function isBandit(pathname: string) {
  return pathname === "/bandit" || pathname === "/bandit/";
}

/** Runs with the platform head middleware. /bandit is rewritten to the Bandit manifest only. */
export default async function banditHeadMiddleware(
  event: BanditHeadEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const result = await next();
  if ((event.req.method ?? "GET").toUpperCase() !== "GET") return result;
  if (!isBandit(event.url.pathname)) return result;
  if (!(result instanceof Response)) return result;
  const type = result.headers.get("content-type") ?? "";
  if (!type.includes("text/html") || !result.body) return result;
  const html = rewriteBanditHead(await result.text());
  const headers = new Headers(result.headers);
  headers.delete("content-length");
  return new Response(html, {
    status: result.status,
    statusText: result.statusText,
    headers,
  });
}

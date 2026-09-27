import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

export const getBanditDesk = createServerFn({ method: "GET" }).handler(async () => {
  const { BANDIT_COOKIE, sessionOk } = await import("./bandit-gate.server");
  if (!sessionOk(getCookie(BANDIT_COOKIE))) return { open: false as const };
  const { BANDIT_UPDATED, DESK, MODELS, TRICIA } = await import("./bandit-copy.server");
  return { open: true as const, updated: BANDIT_UPDATED, tricia: TRICIA, models: MODELS, desk: DESK };
});

export const unlockBandit = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ code: z.string().max(80) }).parse(data))
  .handler(async ({ data }) => {
    const { BANDIT_COOKIE, codeMatches, sessionToken } = await import("./bandit-gate.server");
    if (!codeMatches(data.code)) return { ok: false as const };
    const secure = getRequest().url.startsWith("https:");
    setCookie(BANDIT_COOKIE, sessionToken(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      secure,
    });
    return { ok: true as const };
  });

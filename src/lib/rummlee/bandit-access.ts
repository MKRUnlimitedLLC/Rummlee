import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const BANDIT_GATE_STORAGE = "bandit.gate";

export const banditOpen = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { banditCookieOpen } = await import("./bandit-gate.server");
    return { open: await banditCookieOpen() };
  } catch {
    return { open: false };
  }
});

export const unlockBandit = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ code: z.string().max(200) }).parse(data))
  .handler(async ({ data }) => {
    const { unlockBanditCode } = await import("./bandit-gate.server");
    return unlockBanditCode(data.code);
  });

export const resumeBandit = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string().max(128) }).parse(data))
  .handler(async ({ data }) => {
    const { resumeBanditToken } = await import("./bandit-gate.server");
    return resumeBanditToken(data.token);
  });

export const askBandit = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        question: z.string().max(500),
        token: z.string().max(128).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { askOpenBandit } = await import("./bandit-gate.server");
    return askOpenBandit(data.question, data.token);
  });

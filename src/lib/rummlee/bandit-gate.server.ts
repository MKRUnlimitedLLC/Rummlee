import { getCookie, setCookie } from "@tanstack/react-start/server";
import { answerBandit } from "./bandit";
import { banditAccessCode, banditCodesMatch, banditGateToken, banditTokenMatches } from "./bandit-gate";

export const BANDIT_GATE_COOKIE = "bandit_gate";
const MAX_AGE = 60 * 60 * 24 * 400;

function cookieSecure() {
  return process.env.NODE_ENV === "production";
}

function writeGateCookie(token: string) {
  setCookie(BANDIT_GATE_COOKIE, token, {
    path: "/",
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    maxAge: MAX_AGE,
  });
}

export async function banditCookieOpen() {
  const code = banditAccessCode();
  if (!code) return false;
  return banditTokenMatches(getCookie(BANDIT_GATE_COOKIE), code);
}

export async function unlockBanditCode(given: string) {
  const code = banditAccessCode();
  if (!banditCodesMatch(given, code)) return { ok: false as const };
  const token = banditGateToken(code);
  writeGateCookie(token);
  return { ok: true as const, token };
}

export async function resumeBanditToken(token: string) {
  const code = banditAccessCode();
  if (!banditTokenMatches(token, code)) return { ok: false as const };
  writeGateCookie(token);
  return { ok: true as const };
}

export async function askOpenBandit(question: string, token?: string) {
  const code = banditAccessCode();
  const open = (await banditCookieOpen()) || banditTokenMatches(token, code);
  if (!open) return { ok: false as const };
  if (token && banditTokenMatches(token, code)) writeGateCookie(banditGateToken(code));
  const { readFeeTable } = await import("./server");
  let table = null;
  try {
    const fees = await readFeeTable();
    table = fees.length ? fees : null;
  } catch {
    table = null;
  }
  return { ok: true as const, answer: answerBandit(question, table) };
}

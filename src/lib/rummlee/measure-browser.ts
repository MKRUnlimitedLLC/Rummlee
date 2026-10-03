import { recordMeasure } from "./measure-log";
import {
  adsSendTo,
  buildMeasureRow,
  consentSetCookie,
  googleIds,
  gtagScriptUrl,
  readConsent,
  type MeasureEvent,
} from "./measure";

const LOCAL = "rummlee.cookies.v2";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let armed = false;
let lastPage = "";

export function currentConsent() {
  if (typeof document === "undefined") return null;
  const fromCookie = readConsent(document.cookie);
  if (fromCookie) return fromCookie;
  try {
    const saved = localStorage.getItem(LOCAL);
    if (saved === "essential" || saved === "all") return saved;
  } catch {
    /* private mode */
  }
  return null;
}

function loadGoogle() {
  const ids = googleIds(import.meta.env.VITE_GA_MEASUREMENT_ID, import.meta.env.VITE_GOOGLE_ADS_ID);
  if (!ids.length || typeof window.gtag !== "function") return;
  window.gtag("consent", "update", {
    ad_storage: "granted",
    analytics_storage: "granted",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  if (!document.querySelector("script[data-rummlee-gtag]")) {
    const script = document.createElement("script");
    script.async = true;
    script.dataset.rummleeGtag = "1";
    script.src = gtagScriptUrl(ids[0]) ?? "";
    document.head.appendChild(script);
    window.gtag("js", new Date());
    for (const id of ids) window.gtag("config", id, { allow_google_signals: false });
  }
}

export function armMeasurement() {
  if (armed || currentConsent() !== "all") return;
  armed = true;
  loadGoogle();
}

export function chooseConsent(choice: "essential" | "all") {
  document.cookie = consentSetCookie(choice, location.protocol === "https:");
  try {
    localStorage.setItem(LOCAL, choice);
  } catch {
    /* private mode */
  }
  if (choice === "all") {
    armed = false;
    armMeasurement();
    lastPage = "";
    trackPage();
  }
}

export function track(event: MeasureEvent) {
  if (currentConsent() !== "all") return;
  const row = buildMeasureRow(event, location.pathname, location.search);
  if (!row) return;
  void recordMeasure({ data: row }).catch(() => {
    /* a failed count must not block the signup */
  });
  if (typeof window.gtag !== "function") return;
  const sendTo =
    event === "launch_signup"
      ? adsSendTo(import.meta.env.VITE_GOOGLE_ADS_SIGNUP_SEND_TO)
      : event === "handoff_apply"
        ? adsSendTo(import.meta.env.VITE_GOOGLE_ADS_HANDOFF_SEND_TO)
        : null;
  if (sendTo) window.gtag("event", "conversion", { send_to: sendTo });
  else if (event !== "page_view") window.gtag("event", event);
}

export function trackPage() {
  const key = `${location.pathname}${location.search}`;
  if (key === lastPage) return;
  lastPage = key;
  track("page_view");
}

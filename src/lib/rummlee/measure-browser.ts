import { recordMeasure } from "./measure-log";
import {
  buildMeasureRow,
  consentSetCookie,
  googleEventCalls,
  googleIds,
  gtagScriptUrl,
  META_PAGE_VIEW,
  metaEventFor,
  planMetaLoad,
  readConsent,
  type MeasureEvent,
} from "./measure";

const LOCAL = "rummlee.cookies.v2";

type MetaFbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: MetaFbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface ImportMetaEnv {
    readonly VITE_META_PIXEL_ID?: string;
  }
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: MetaFbq;
    _fbq?: MetaFbq;
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

function metaPixelEnv(): string | undefined {
  const value = import.meta.env.VITE_META_PIXEL_ID;
  return typeof value === "string" ? value : undefined;
}

function ensureFbq(): MetaFbq {
  if (window.fbq) return window.fbq;
  const queue: unknown[][] = [];
  const stub = function (...args: unknown[]) {
    const current = window.fbq;
    if (current?.callMethod) current.callMethod(...args);
    else queue.push(args);
  } as MetaFbq;
  stub.queue = queue;
  stub.loaded = true;
  stub.version = "2.0";
  stub.push = stub;
  window.fbq = stub;
  if (!window._fbq) window._fbq = stub;
  return stub;
}

/** Standard base pixel. No advanced matching, and no automatic form scraping. */
function loadMeta() {
  const plan = planMetaLoad(currentConsent(), metaPixelEnv());
  if (!plan || document.querySelector("script[data-rummlee-meta]")) return;
  const fbq = ensureFbq();
  const script = document.createElement("script");
  script.async = true;
  script.dataset.rummleeMeta = "1";
  script.src = plan.src;
  const first = document.getElementsByTagName("script")[0];
  if (first?.parentNode) first.parentNode.insertBefore(script, first);
  else document.head.appendChild(script);
  fbq("set", "autoConfig", false, plan.id);
  fbq("init", plan.id);
  fbq("track", META_PAGE_VIEW);
}

function sendMeta(event: MeasureEvent) {
  const call = metaEventFor(event);
  if (!call || typeof window.fbq !== "function") return;
  window.fbq(call.method, call.name);
}

export function armMeasurement() {
  if (armed || currentConsent() !== "all") return;
  armed = true;
  loadGoogle();
  loadMeta();
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
  sendMeta(event);
  if (typeof window.gtag !== "function") return;
  for (const call of googleEventCalls(
    event,
    import.meta.env.VITE_GA_MEASUREMENT_ID,
    import.meta.env.VITE_GOOGLE_ADS_SIGNUP_SEND_TO,
    import.meta.env.VITE_GOOGLE_ADS_HANDOFF_SEND_TO,
  )) {
    if (call.params) window.gtag("event", call.name, call.params);
    else window.gtag("event", call.name);
  }
}

export function trackPage() {
  const key = `${location.pathname}${location.search}`;
  if (key === lastPage) return;
  lastPage = key;
  track("page_view");
}

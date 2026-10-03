import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppShell } from "@/components/app-shell";
import { makeQueryClient } from "@/lib/query-client";
import { CONSENT_BOOT } from "@/lib/rummlee/measure";
import appCss from "../styles.css?url";

const APP_NAME = "Rummlee";
const DEFAULT_TITLE = "Rummlee — The good stuff, before Saturday";
const DEFAULT_DESCRIPTION =
  "Rummlee isn’t open yet. Sign up to be first to know about updates and the launch. Pickup will be at an official handoff location. Nothing ships. Handoff method patent pending.";
const SITE_URL = "https://rummlee.com/";
const OG_IMAGE = "https://rummlee.com/og.jpg";

const fetchSessionUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const u = await getSessionUser();
  return u ? { id: u.id } : null;
});

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/bandit" || location.pathname === "/bandit/") return { sessionUser: null };
    return { sessionUser: await fetchSessionUser() };
  },
  head: ({ matches }) => {
    const bandit = matches.some((match) => match.pathname === "/bandit");
    const path = matches[matches.length - 1]?.pathname || "/";
    const canonical = path === "/" ? "https://rummlee.com/" : `https://rummlee.com${path}`;
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        ...(bandit ? [] : [{ title: DEFAULT_TITLE }]),
        { name: "theme-color", content: bandit ? "#e4dfd6" : "#C8101E" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "mobile-web-app-capable", content: "yes" },
        ...(bandit ? [] : [{ name: "apple-mobile-web-app-title", content: APP_NAME }]),
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
        { name: "description", content: DEFAULT_DESCRIPTION },
        // One share-card set. The platform head injector strips these and writes them back from the document.
        ...(bandit
          ? []
          : [
              { property: "og:title", content: DEFAULT_TITLE },
              { property: "og:description", content: DEFAULT_DESCRIPTION },
              { property: "og:url", content: SITE_URL },
              { property: "og:image", content: OG_IMAGE },
              { property: "og:type", content: "website" },
              { name: "twitter:card", content: "summary_large_image" },
            ]),
      ],
      links: [
        ...(bandit ? [] : [{ rel: "canonical", href: canonical }]),
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "stylesheet", href: appCss },
        ...(bandit
          ? []
          : [
              { rel: "manifest", href: "/__grok/manifest.webmanifest" },
              { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
            ]),
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap",
        },
      ],
    };
  },
  component: Root,
});

function Root() {
  const [queryClient] = useState(makeQueryClient);
  return (
    <html lang="en" className="antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: CONSENT_BOOT }} />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var s=localStorage.getItem('rummlee.theme.v1');var dark=s==='dark'||(s!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);if(dark)document.documentElement.classList.add('rummlee-dark');}catch(e){}})();",
          }}
        />
        <HeadContent />
      </head>
      <body className="font-sans">
        <PreviewHostBridge />
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <AppShell>
              <Outlet />
            </AppShell>
            <Toaster
              position="top-center"
              toastOptions={{
                className: "!bg-surface !text-fg !border-border !font-sans",
              }}
            />
          </QueryClientProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

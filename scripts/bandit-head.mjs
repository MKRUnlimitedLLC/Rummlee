/** Strip the site-wide Rummlee manifest and icon from a /bandit document.
 * @param {string} html
 */
export function rewriteBanditHead(html) {
  if (typeof html !== "string" || !html.includes("<")) return html;
  let next = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = /rel=["']([^"']+)["']/i.exec(tag)?.[1] ?? "";
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1] ?? "";
    const rels = rel.split(/\s+/);
    if (rels.includes("manifest") && !href.includes("/bandit/manifest.webmanifest")) return "";
    if (rels.includes("apple-touch-icon") && href.includes("/__grok/")) return "";
    if (href === "/__grok/manifest.webmanifest" || href === "/__grok/icon-180.png") return "";
    return tag;
  });
  next = next.replace(/<meta\b[^>]*name=["']apple-mobile-web-app-title["'][^>]*>/gi, (tag) =>
    /content=["']Bandit["']/i.test(tag) ? tag : "",
  );
  if (!/<title[^>]*>\s*Bandit\s*<\/title>/i.test(next)) {
    if (/<title[^>]*>[^<]*<\/title>/i.test(next)) {
      next = next.replace(/<title[^>]*>[^<]*<\/title>/i, "<title>Bandit</title>");
    } else {
      next = next.replace(/<\/head>/i, "<title>Bandit</title></head>");
    }
  }
  if (!next.includes("/bandit/manifest.webmanifest")) {
    next = next.replace(/<\/head>/i, '<link rel="manifest" href="/bandit/manifest.webmanifest"></head>');
  }
  const hasDogIcon =
    /rel=["']apple-touch-icon["'][^>]*href=["']\/apple-touch-icon\.png["']/i.test(next) ||
    /href=["']\/apple-touch-icon\.png["'][^>]*rel=["']apple-touch-icon["']/i.test(next);
  if (!hasDogIcon) {
    next = next.replace(/<\/head>/i, '<link rel="apple-touch-icon" href="/apple-touch-icon.png"></head>');
  }
  const hasBanditName =
    /name=["']apple-mobile-web-app-title["'][^>]*content=["']Bandit["']/i.test(next) ||
    /content=["']Bandit["'][^>]*name=["']apple-mobile-web-app-title["']/i.test(next);
  if (!hasBanditName) {
    next = next.replace(/<\/head>/i, '<meta name="apple-mobile-web-app-title" content="Bandit"></head>');
  }
  return next;
}

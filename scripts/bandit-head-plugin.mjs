import { rewriteBanditHead } from "./bandit-head.mjs";

function isBanditDocument(url) {
  const path = String(url ?? "").split("?", 1)[0];
  return path === "/bandit" || path === "/bandit/";
}

function toBuffer(chunk, encoding) {
  if (!chunk) return null;
  if (Buffer.isBuffer(chunk)) return chunk;
  if (typeof chunk === "string") return Buffer.from(chunk, typeof encoding === "string" ? encoding : "utf8");
  return Buffer.from(chunk);
}

/** Outer HTML rewrite so /bandit wins after the platform head injector. */
export function banditHeadPlugin() {
  const wrap = (middlewares) => {
    middlewares.use((req, res, next) => {
      if ((req.method ?? "GET").toUpperCase() !== "GET" || !isBanditDocument(req.url)) {
        next();
        return;
      }
      const chunks = [];
      const originalEnd = res.end.bind(res);

      res.write = (chunk, encoding, cb) => {
        const done = typeof encoding === "function" ? encoding : cb;
        const buf = toBuffer(chunk, encoding);
        if (buf) chunks.push(buf);
        if (typeof done === "function") done();
        return true;
      };

      res.end = (chunk, encoding, cb) => {
        let done = cb;
        let enc = encoding;
        if (typeof chunk === "function") {
          done = chunk;
          chunk = undefined;
          enc = undefined;
        } else if (typeof encoding === "function") {
          done = encoding;
          enc = undefined;
        }
        const buf = toBuffer(chunk, enc);
        if (buf) chunks.push(buf);
        const type = String(res.getHeader("content-type") ?? "");
        const raw = Buffer.concat(chunks);
        const text = raw.toString("utf8");
        const html = type.includes("text/html") || text.trimStart().startsWith("<!");
        if (!res.headersSent) res.removeHeader("content-length");
        if (!html) return originalEnd(raw, done);
        return originalEnd(Buffer.from(rewriteBanditHead(text)), done);
      };

      next();
    });
  };

  return {
    name: "rummlee:bandit-head",
    configureServer(server) {
      wrap(server.middlewares);
    },
    configurePreviewServer(server) {
      return () => {
        wrap(server.middlewares);
      };
    },
  };
}

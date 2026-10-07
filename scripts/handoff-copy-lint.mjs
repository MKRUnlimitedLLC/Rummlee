#!/usr/bin/env node
/**
 * Handoff wording lint. Rummlee says it one way everywhere:
 * "Official store handoff" first, "public place" as the backup, person to person optional, and "Nothing ships."
 *
 * Fails when a retired variant shows up in user-facing copy: web routes and meta, components, lib copy,
 * public/ (llms.txt, sitemap), native store notes, the README, and the private briefing files.
 * Historical pitch docs (docs/, exports/), SQL migrations, and tests are not scanned.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const RETIRED = [
  { re: /partner[- ]?stores?/i, use: "official store" },
  { re: /official partner/i, use: "official store" },
  { re: /partner locations?/i, use: "official store" },
  { re: /partner counters?/i, use: "official store" },
  { re: /handoff locations?/i, use: "handoff / official store handoff / public place handoff" },
  { re: /(?<![-\w])handoff stores?/i, use: "official store" },
  { re: /local pickup/i, use: "official store handoff" },
  { re: /no shipping/i, use: "Nothing ships." },
  { re: /never ships?\b/i, use: "Nothing ships." },
];

export const SCAN_ROOTS = ["public", "src", "native", "server/bandit-private", "README.md"];
const TEXT_EXT = new Set([".txt", ".xml", ".md", ".json", ".ts", ".tsx", ".js", ".mjs", ".css", ".html", ".svg", ".webmanifest"]);
const SKIP_DIR = new Set(["node_modules", ".git", ".output", ".vercel", "dist"]);

function isTest(path) {
  return /\.test\.[cm]?[jt]sx?$/.test(path);
}

export function lintText(text, file) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  let off = false;
  lines.forEach((line, index) => {
    // Only for code that rewrites legacy stored rows: `handoff-copy-lint: off` ... `handoff-copy-lint: on`.
    if (line.includes("handoff-copy-lint: off")) off = true;
    if (line.includes("handoff-copy-lint: on")) {
      off = false;
      return;
    }
    if (off) return;
    for (const { re, use } of RETIRED) {
      const m = line.match(re);
      if (m) {
        hits.push({ file, line: index + 1, found: m[0], use });
        continue;
      }
      // Copy wrapped across two source lines ("an official handoff\n location").
      const next = lines[index + 1];
      if (next === undefined) continue;
      const joined = `${line.trimEnd()} ${next.trimStart()}`;
      const j = joined.match(re);
      if (j && !next.match(re)) hits.push({ file, line: index + 1, found: j[0], use });
    }
  });
  return hits;
}

function walk(abs, out) {
  let st;
  try {
    st = statSync(abs);
  } catch {
    return;
  }
  if (st.isDirectory()) {
    for (const name of readdirSync(abs)) {
      if (!SKIP_DIR.has(name)) walk(join(abs, name), out);
    }
  } else if (TEXT_EXT.has(extname(abs)) && !isTest(abs)) {
    out.push(abs);
  }
}

export function lintRepo(root) {
  const files = [];
  for (const r of SCAN_ROOTS) walk(join(root, r), files);
  return files.flatMap((abs) => lintText(readFileSync(abs, "utf8"), relative(root, abs)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(fileURLToPath(import.meta.url), "..", "..");
  const hits = lintRepo(root);
  for (const h of hits) console.log(`${h.file}:${h.line}: "${h.found}" is retired. Use: ${h.use}`);
  if (hits.length) {
    console.log(`handoff-copy-lint: ${hits.length} retired handoff phrase(s)`);
    process.exit(1);
  }
  console.log("handoff-copy-lint: ok");
}

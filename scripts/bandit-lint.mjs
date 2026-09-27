#!/usr/bin/env node
/**
 * Fails when the private briefing can leak into the public site.
 *   node scripts/bandit-lint.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const NAMES = ["Kirstin", "Diane", "Erin"];
const CODE = "Kite-4419";

export function lintBandit(root) {
  const errors = [];
  const pub = join(root, "public", "bandit");
  if (existsSync(pub)) {
    const names = readdirSync(pub);
    errors.push(
      names.length
        ? `public/bandit is served with no code: ${names.join(", ")}`
        : "public/bandit exists. Remove the directory.",
    );
  }

  const gate = join(root, "server", "middleware", "bandit-gate.ts");
  if (!existsSync(gate)) errors.push("Missing server/middleware/bandit-gate.ts");
  else if (!readFileSync(gate, "utf8").includes("Code required.")) {
    errors.push("bandit-gate.ts must refuse with “Code required.”");
  } else if (!readFileSync(gate, "utf8").includes("renderExplainPage")) {
    errors.push("bandit-gate.ts must serve the explainer from the current copy.");
  }

  for (const file of [
    "server/bandit-private/rummlee-tricia.html",
    "server/bandit-private/tricia-rummlee-briefing.html",
    "server/bandit-private/TRICIA-GROK-COMPANION.txt",
    "server/bandit-private/TRICIA-RUMMLEE-COMPANION.txt",
    "src/lib/rummlee/bandit-gate.server.ts",
    "src/lib/rummlee/bandit-copy.server.ts",
  ]) {
    if (!existsSync(join(root, file))) errors.push(`Missing ${file}`);
  }

  const client = [
    ...walk(join(root, "src", "routes")),
    ...walk(join(root, "src", "components")),
    join(root, "src", "lib", "rummlee", "bandit-types.ts"),
    join(root, "src", "lib", "rummlee", "bandit.ts"),
  ];
  for (const file of client) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    const rel = relative(root, file);
    for (const name of NAMES) {
      if (text.includes(name)) errors.push(`${rel} contains ${name}. Keep names in server-only files.`);
    }
    if (text.includes(CODE)) errors.push(`${rel} contains the briefing code.`);
    if (text.includes("bandit-copy.server") || text.includes("bandit-gate.server")) {
      errors.push(`${rel} imports a server-only briefing module.`);
    }
  }

  const api = join(root, "src", "lib", "rummlee", "bandit-api.ts");
  if (existsSync(api) && !readFileSync(api, "utf8").includes('await import("./bandit-gate.server")')) {
    errors.push("bandit-api.ts must load the gate with a server-only import.");
  }
  return errors;
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

function main() {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const errors = lintBandit(root);
  if (!errors.length) {
    console.log("bandit lint ok");
    return;
  }
  for (const error of errors) console.error(error);
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();

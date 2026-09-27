import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { lintBandit } from "./bandit-lint.mjs";

function tree(dir, files) {
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body);
  }
}

const REQUIRED = {
  "server/middleware/bandit-gate.ts": 'return denied(401, "Code required.");',
  "server/bandit-private/rummlee-tricia.html": "deck",
  "server/bandit-private/tricia-rummlee-briefing.html": "deck",
  "server/bandit-private/TRICIA-GROK-COMPANION.txt": "note",
  "server/bandit-private/TRICIA-RUMMLEE-COMPANION.txt": "note",
  "src/lib/rummlee/bandit-gate.server.ts": "server",
  "src/lib/rummlee/bandit-copy.server.ts": "Kirstin",
  "src/lib/rummlee/bandit-api.ts": 'await import("./bandit-gate.server")',
  "src/routes/bandit.tsx": "This page needs a code.",
};

test("a closed briefing passes", () => {
  const root = mkdtempSync(join(tmpdir(), "bandit-ok-"));
  tree(root, REQUIRED);
  assert.deepEqual(lintBandit(root), []);
});

test("a public deck and a name in the route fail", () => {
  const root = mkdtempSync(join(tmpdir(), "bandit-bad-"));
  tree(root, {
    ...REQUIRED,
    "public/bandit/rummlee-tricia.html": "open",
    "src/routes/bandit.tsx": "Kirstin is here",
  });
  const errors = lintBandit(root);
  assert.ok(errors.some((e) => e.includes("public/bandit")));
  assert.ok(errors.some((e) => e.includes("Kirstin")));
});

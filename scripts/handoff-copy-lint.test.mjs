import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { lintRepo, lintText } from "./handoff-copy-lint.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("every retired handoff variant is caught", () => {
  const retired = [
    "Meet at a partner store.",
    "Official partner store",
    "a partner-store badge",
    "Pickup is at an official handoff location.",
    "Public handoff location",
    "Be a partner location",
    "A partner counter holds it.",
    "Become a Rummlee handoff store",
    "Local pickup.",
    "No shipping.",
    "Rummlee never ships.",
  ];
  for (const line of retired) assert.equal(lintText(line, "x").length > 0, true, line);
});

test("the canonical wording passes", () => {
  const ok = [
    "Official store handoff first. A public place is the backup. Person to person is optional. Nothing ships.",
    "Public place handoff",
    "Apply to be an official store.",
    'handoff: "official" | "public" | "person" | "partner";',
    "Confirm pickup with the code.",
    "A per-handoff store payment can be switched on later.",
  ];
  for (const line of ok) assert.deepEqual(lintText(line, "x"), [], line);
});

test("the repo's user-facing copy has no retired handoff wording", () => {
  const hits = lintRepo(ROOT);
  assert.deepEqual(
    hits.map((h) => `${h.file}:${h.line} ${h.found}`),
    [],
  );
});

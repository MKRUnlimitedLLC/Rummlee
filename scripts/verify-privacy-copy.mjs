import { readFileSync } from "node:fs";

const files = {
  "welcome.tsx": "src/routes/welcome.tsx",
  "you.tsx": "src/routes/you.tsx",
  "inbox.tsx": "src/routes/inbox.tsx",
  "terms.tsx": "src/routes/terms.tsx",
  "privacy.tsx": "src/routes/privacy.tsx",
};

const text = Object.fromEntries(
  Object.entries(files).map(([name, path]) => [name, readFileSync(path, "utf8")]),
);

const problems = [];

function mustContain(name, needle) {
  if (!text[name].includes(needle)) problems.push(`MISSING ${name}: ${needle}`);
}

function mustNotContain(name, needle) {
  if (text[name].includes(needle)) problems.push(`BANNED ${name}: ${needle}`);
}

mustContain(
  "welcome.tsx",
  "A street address is never on a public listing. If you offer an in-person handoff, that note is shown only after someone pays.",
);
mustNotContain("welcome.tsx", "We never ask for a home address.");

mustContain(
  "you.tsx",
  "Neighbors never see your address on a listing — only a neighborhood label, if you set one.",
);

mustContain("inbox.tsx", "Public place, or the handoff already offered. Not a home address.");
mustNotContain("inbox.tsx", "unless you both want that.");

mustContain("terms.tsx", "Updated October 6, 2026.");
mustContain(
  "terms.tsx",
  "A street address is not posted on a listing. A private meetup note, if the seller writes one, is shown only after someone pays. Do not put a home address in a message.",
);
mustNotContain("terms.tsx", "Addresses are not posted.");

mustContain("privacy.tsx", "Updated October 4, 2026.");
mustContain("privacy.tsx", "Allow measurement");
mustContain("privacy.tsx", "in a note or in a message.");

for (const name of Object.keys(files)) {
  for (const banned of ["patented", "64/115,064", "7389", "17th Street"]) {
    if (text[name].includes(banned)) problems.push(`BANNED ${name}: ${banned}`);
  }
}

if (problems.length > 0) {
  for (const line of problems) console.log(line);
  process.exit(1);
}

console.log("verify-privacy-copy: ok");

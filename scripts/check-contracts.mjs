#!/usr/bin/env node
/**
 * check-contracts.mjs
 *
 * PURPOSE
 *   A shrink-only census of the places where untrusted input enters a handler
 *   WITHOUT a contract. Every handler is meant to read its body and query
 *   through parseBody / parseQuery (and, from plan 06-08, parseForm) in
 *   src/server/body.ts, against a zod schema from src/contracts/. A site that
 *   reads raw input bypasses that boundary, and this gate is the only thing
 *   stopping a new one from landing (threat T-06-04-03).
 *
 *   It FAILS when the live census holds a (file, rule) the committed
 *   allow-list does not, or holds more sites for one than the list commits.
 *   It PASSES when the census is smaller, and names what retired: the list
 *   is meant to shrink family by family (06-04 slice 6, then 06-08..06-10)
 *   until it is empty.
 *
 * REQUIREMENT
 *   REFAC-15 (every handler validates its input with a schema), F-094 (a
 *   malformed or wrongly typed body reaches field logic and answers 500),
 *   DEC-65 (the boundary, today's texts, `field` only where named).
 *
 * SCOPE AND RULES
 *   Files: src/**\/*.{ts,tsx,js,jsx,mjs,cjs}, minus test files (*.test.*),
 *   because a test file is not shipped and builds requests on purpose.
 *   Lines whose trimmed text starts with a comment marker (//, /*, *) are
 *   skipped, so a docblock that quotes `request.json()` is not a site.
 *
 *   R1  a raw JSON read on a request object, `request.json()` or
 *       `req.json()`, anywhere outside src/server/body.ts
 *   R2  a multipart read, `.formData()`, anywhere outside src/server/body.ts
 *   R3  a query read, `searchParams.get|getAll|has(`, in src/app/**\/route.ts.
 *       src/app/auth/callback/route.ts is exempt for EXACTLY the four OAuth
 *       parameters its provider sends (code, next, error, error_description):
 *       they are an external protocol's names, read once and validated by
 *       the callback's own logic (the `next` redirect check). Any other
 *       parameter read there is counted.
 *   R4  a `readJsonObject(` call in src/app/**\/route.ts: a body read with no
 *       schema. readJsonObject stays exported for parseBody's use.
 *
 * INVOCATION
 *   node scripts/check-contracts.mjs                     # check (CI)
 *   node scripts/check-contracts.mjs --write             # regenerate the list
 *   node scripts/check-contracts.mjs --root <dir> --allowlist <file>
 *                                                         # fixture trees (tests)
 *
 *   Runs in CI as the "Contracts census" step, after the elevated-callsite
 *   ratchet. `--write` is not a way to make a failing check pass: it was run
 *   once, by plan 06-04 Task 1, to take the initial census; after that the
 *   list is edited by hand, only by deleting entries.
 *
 * OUTPUT
 *   committed=<sites> live=<sites> delta=<live - committed>
 *   A site is one matching line; an entry is { file, rule, count }.
 *
 * DEPENDENCIES
 *   None. Node built-ins only.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    console.error(`FAIL: ${name} needs a value`);
    process.exit(1);
  }
  return value;
}

const ROOT = resolve(argValue("--root") ?? join(SCRIPT_DIR, ".."));
const ALLOWLIST = resolve(
  argValue("--allowlist") ?? join(ROOT, "scripts", "contracts-allowlist.json")
);
const SCAN_DIR = join(ROOT, "src");

/** The boundary itself: the only file allowed to read raw bodies. */
const BOUNDARY = "src/server/body.ts";

const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
const ROUTE_FILE = /^src\/app\/(.+\/)?route\.[cm]?[jt]sx?$/;
const COMMENT_LINE = /^(\/\/|\/\*|\*)/;

const CALLBACK = "src/app/auth/callback/route.ts";
const CALLBACK_PARAMS = new Set(["code", "next", "error", "error_description"]);

const RULES = [
  {
    id: "R1",
    what: "raw JSON read on a request object",
    pattern: /\b(request|req)\.json\(\)/,
    applies: (file) => file !== BOUNDARY,
  },
  {
    id: "R2",
    what: "multipart read",
    pattern: /\.formData\(\)/,
    applies: (file) => file !== BOUNDARY,
  },
  {
    id: "R3",
    what: "query read in a route file",
    pattern: /searchParams\.(get|getAll|has)\(/g,
    applies: (file) => ROUTE_FILE.test(file),
    exempt: (file, line) => {
      if (file !== CALLBACK) return false;
      // Exempt only when EVERY read on the line names one of the four params.
      const reads = [
        ...line.matchAll(/searchParams\.(?:get|getAll|has)\(\s*(["'`])([^"'`]*)\1\s*\)/g),
      ];
      const all = [...line.matchAll(/searchParams\.(get|getAll|has)\(/g)];
      return (
        reads.length === all.length &&
        reads.every((match) => CALLBACK_PARAMS.has(match[2]))
      );
    },
  },
  {
    id: "R4",
    what: "readJsonObject( in a route file (a body read with no schema)",
    pattern: /\breadJsonObject\(/,
    applies: (file) => ROUTE_FILE.test(file),
  },
];

function walk(dir) {
  let out = [];
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (name === "node_modules") continue;
      out = out.concat(walk(full));
    } else if (SOURCE_FILE.test(name) && !TEST_FILE.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** Every matching line, as { file, rule, line }. */
function liveSites() {
  const sites = [];
  for (const full of walk(SCAN_DIR)) {
    const file = relative(ROOT, full).split(sep).join("/");
    const lines = readFileSync(full, "utf8").split("\n");
    lines.forEach((text, index) => {
      if (COMMENT_LINE.test(text.trim())) return;
      for (const rule of RULES) {
        if (!rule.applies(file)) continue;
        const pattern = new RegExp(rule.pattern.source);
        if (!pattern.test(text)) continue;
        if (rule.exempt?.(file, text)) continue;
        sites.push({ file, rule: rule.id, line: index + 1 });
      }
    });
  }
  return sites;
}

const key = (entry) => `${entry.file}\u0000${entry.rule}`;

function toEntries(sites) {
  const counts = new Map();
  for (const site of sites) {
    const k = key(site);
    const entry = counts.get(k) ?? { file: site.file, rule: site.rule, count: 0 };
    entry.count += 1;
    counts.set(k, entry);
  }
  return [...counts.values()].sort(
    (a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule)
  );
}

const total = (entries) => entries.reduce((sum, entry) => sum + entry.count, 0);

const sites = liveSites();
const live = toEntries(sites);

if (process.argv.includes("--write")) {
  writeFileSync(ALLOWLIST, `${JSON.stringify(live, null, 2)}\n`);
  console.log(
    `wrote ${live.length} entries (${total(live)} sites) to ${relative(ROOT, ALLOWLIST)}`
  );
  process.exit(0);
}

let committed;
try {
  committed = JSON.parse(readFileSync(ALLOWLIST, "utf8"));
} catch (error) {
  console.error(`FAIL: cannot read the allow-list ${ALLOWLIST}: ${error.message}`);
  process.exit(1);
}

const wellFormed =
  Array.isArray(committed) &&
  committed.every(
    (entry) =>
      entry !== null &&
      typeof entry === "object" &&
      typeof entry.file === "string" &&
      RULES.some((rule) => rule.id === entry.rule) &&
      Number.isInteger(entry.count) &&
      entry.count > 0
  );
if (!wellFormed) {
  console.error(
    "FAIL: the allow-list must be a JSON array of { file, rule: R1..R4, count > 0 }"
  );
  process.exit(1);
}

const committedByKey = new Map(committed.map((entry) => [key(entry), entry]));
const liveByKey = new Map(live.map((entry) => [key(entry), entry]));

const grown = live.filter(
  (entry) => entry.count > (committedByKey.get(key(entry))?.count ?? 0)
);
const retired = committed.filter(
  (entry) => (liveByKey.get(key(entry))?.count ?? 0) < entry.count
);

console.log(
  `committed=${total(committed)} live=${total(live)} delta=${total(live) - total(committed)}`
);

if (retired.length > 0) {
  console.log(
    `retired=${retired.length} (the list shrank — this is the intended direction; delete these entries)`
  );
  for (const entry of retired) {
    const now = liveByKey.get(key(entry))?.count ?? 0;
    console.log(`  - ${entry.file} ${entry.rule} ${entry.count} -> ${now}`);
  }
}

if (grown.length > 0) {
  console.error("");
  console.error(
    `FAIL: ${grown.length} (file, rule) pair(s) exceed the committed allow-list:`
  );
  for (const entry of grown) {
    const allowed = committedByKey.get(key(entry))?.count ?? 0;
    const rule = RULES.find((r) => r.id === entry.rule);
    console.error(
      `  + ${entry.file} ${entry.rule} (${rule.what}): live ${entry.count}, allowed ${allowed}`
    );
    for (const site of sites) {
      if (key(site) === key(entry)) {
        console.error(`      ${site.file}:${site.line} ${site.rule}`);
      }
    }
  }
  console.error("");
  console.error("Read input through parseBody / parseQuery in src/server/body.ts");
  console.error("with a schema from src/contracts/. The allow-list may only shrink,");
  console.error("so do NOT add entries or regenerate it to make this pass.");
  process.exit(1);
}

if (committed.length === 0 && live.length === 0) {
  console.log("PASS: the allow-list is empty and the live census is empty");
  process.exit(0);
}

console.log("PASS: the live census is within the committed allow-list");
process.exit(0);

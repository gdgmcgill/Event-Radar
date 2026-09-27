#!/usr/bin/env node
/**
 * check-server-console.mjs
 *
 * PURPOSE
 *   A shrink-only census of two things the structured-logging and
 *   error-vocabulary work (plans 06-12..06-14, 06-17) removes from server code:
 *   raw console calls, which bypass the JSON logger's request id and
 *   redaction, and response bodies built from a caught error's text, which
 *   leak table and constraint names to the client.
 *
 *   It FAILS when the live census holds a (file, rule) the committed
 *   allow-list does not, or holds more sites for one than the list commits.
 *   It PASSES when the census is smaller, and names what retired: the list is
 *   meant to shrink route family by route family until only the reasoned
 *   entries remain.
 *
 * REQUIREMENT
 *   REFAC-20 (structured logs with levels and a correlation id), F-059 (a
 *   caught error's text returned to the client), DEC-74 (the logger and the
 *   request id), DEC-75 (one error vocabulary).
 *
 * SCOPE AND RULES
 *   Files: src/**\/*.{ts,tsx,js,jsx,mjs,cjs}, minus test files (*.test.*).
 *   Lines whose trimmed text starts with a comment marker (//, /*, *) are
 *   skipped, so a docblock that quotes a console call is not a site.
 *
 *   S1  a console call, `console.(log|info|warn|error|debug|trace)(`, in
 *       server scope:
 *         - route files: src/app/**\/route.*
 *         - src/server/** (except src/server/log.ts, the logger's own sink)
 *         - src/proxy.ts, src/instrumentation.ts, src/sentry.server.config.ts
 *         - src/lib/audit.ts, src/lib/tagMapping.ts
 *         - Server Component pages and layouts: src/app/**\/page.* and
 *           src/app/**\/layout.* whose first statement is not "use client"
 *       Client code (components, hooks, client pages, client-only lib
 *       modules) keeps console and is not counted.
 *   S2  a line in a route file carrying a caught error's text: any `.message`
 *       token, except `dateError.message` (the date validator's own 400 text,
 *       not a caught error). The broad token is deliberate: the census is by
 *       reading, and a line that is not a response body (a log line, an
 *       internal throw) is listed with its file until the sweep rewrites it.
 *
 *   The allow-list entries are { file, rule: "S1" | "S2", count, reason? }.
 *   A `reason` marks an entry meant to stay (for example src/lib/tagMapping.ts,
 *   a module shared with client components, which stays on console).
 *
 * INVOCATION
 *   node scripts/check-server-console.mjs                 # check (CI)
 *   node scripts/check-server-console.mjs --write         # regenerate the list
 *   node scripts/check-server-console.mjs --root <dir> --allowlist <file>
 *                                                          # fixture trees (tests)
 *
 *   Runs in CI as the "Server console census" step, after the contracts
 *   census. `--write` is not a way to make a failing check pass: it was run
 *   once, by plan 06-12 Task 3, to take the initial census (it keeps an
 *   existing entry's reason); after that the list is edited by hand, only by
 *   deleting entries or lowering counts.
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
  argValue("--allowlist") ??
    join(ROOT, "scripts", "server-console-allowlist.json")
);
const SCAN_DIR = join(ROOT, "src");

const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
const ROUTE_FILE = /^src\/app\/(.+\/)?route\.[cm]?[jt]sx?$/;
const PAGE_OR_LAYOUT = /^src\/app\/(.+\/)?(page|layout)\.[cm]?[jt]sx?$/;
const COMMENT_LINE = /^(\/\/|\/\*|\*)/;
const USE_CLIENT = /^["']use client["'];?$/;

/** The logger's own sink: the one server file that must call the console. */
const LOGGER = "src/server/log.ts";

/** Named server modules outside src/server/**. */
const NAMED_SERVER_FILES = new Set([
  "src/proxy.ts",
  "src/instrumentation.ts",
  "src/sentry.server.config.ts",
  "src/lib/audit.ts",
  "src/lib/tagMapping.ts",
]);

/** True when the first statement (after blanks and comments) is "use client". */
function isClientModule(lines) {
  let inBlock = false;
  for (const raw of lines) {
    const text = raw.trim();
    if (inBlock) {
      if (text.includes("*/")) inBlock = false;
      continue;
    }
    if (text === "" || text.startsWith("//")) continue;
    if (text.startsWith("/*")) {
      if (!text.includes("*/")) inBlock = true;
      continue;
    }
    return USE_CLIENT.test(text);
  }
  return false;
}

function inServerScope(file, lines) {
  if (file === LOGGER) return false;
  if (ROUTE_FILE.test(file)) return true;
  if (file.startsWith("src/server/")) return true;
  if (NAMED_SERVER_FILES.has(file)) return true;
  if (PAGE_OR_LAYOUT.test(file)) return !isClientModule(lines);
  return false;
}

const RULES = [
  {
    id: "S1",
    what: "console call in server scope (use log from src/server/log.ts)",
    pattern: /\bconsole\.(log|info|warn|error|debug|trace)\s*\(/,
    applies: (file, lines) => inServerScope(file, lines),
  },
  {
    id: "S2",
    what: "caught error text in a route file (return the generic body; log the error)",
    pattern: /\.message\b/,
    applies: (file) => ROUTE_FILE.test(file),
    exempt: (_file, line) => /\bdateError\.message\b/.test(line),
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
    const rules = RULES.filter((rule) => rule.applies(file, lines));
    if (rules.length === 0) continue;
    lines.forEach((text, index) => {
      if (COMMENT_LINE.test(text.trim())) return;
      for (const rule of rules) {
        if (!rule.pattern.test(text)) continue;
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

function readAllowlist({ required }) {
  let committed;
  try {
    committed = JSON.parse(readFileSync(ALLOWLIST, "utf8"));
  } catch (error) {
    if (!required) return [];
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
        entry.count > 0 &&
        (entry.reason === undefined || typeof entry.reason === "string")
    );
  if (!wellFormed) {
    console.error(
      "FAIL: the allow-list must be a JSON array of { file, rule: S1|S2, count > 0, reason?: string }"
    );
    process.exit(1);
  }
  return committed;
}

const sites = liveSites();
const live = toEntries(sites);

if (process.argv.includes("--write")) {
  const reasons = new Map(
    readAllowlist({ required: false })
      .filter((entry) => entry.reason)
      .map((entry) => [key(entry), entry.reason])
  );
  const written = live.map((entry) =>
    reasons.has(key(entry)) ? { ...entry, reason: reasons.get(key(entry)) } : entry
  );
  writeFileSync(ALLOWLIST, `${JSON.stringify(written, null, 2)}\n`);
  console.log(
    `wrote ${written.length} entries (${total(written)} sites) to ${relative(ROOT, ALLOWLIST)}`
  );
  process.exit(0);
}

const committed = readAllowlist({ required: true });
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
    `retired=${retired.length} (the list shrank — this is the intended direction; lower or delete these entries)`
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
  console.error("Log through `log` from src/server/log.ts (one redacted JSON line with");
  console.error("the request id), and answer a caught error with the route's generic");
  console.error("body (serverError). The allow-list may only shrink, so do NOT add");
  console.error("entries or regenerate it to make this pass.");
  process.exit(1);
}

if (committed.length === 0 && live.length === 0) {
  console.log("PASS: the allow-list is empty and the live census is empty");
  process.exit(0);
}

console.log("PASS: the live census is within the committed allow-list");
process.exit(0);

#!/usr/bin/env node
/**
 * check-elevated-ratchet.mjs
 *
 * PURPOSE
 *   Assert that the committed allow-list of legacy service-role callsites is a
 *   SUPERSET of the live census. The list may only shrink.
 *
 *   It FAILS when the live census holds an entry the committed list does not —
 *   that is a new file reaching the RLS-bypassing credential, and catching it
 *   is what the whole control is for.
 *
 *   It PASSES when the live census is smaller, and names the entries that have
 *   been retired, because shrinking is the intended direction: Phases 4-6
 *   migrate these routes to src/server/db/elevated/ one at a time, deleting a
 *   row each.
 *
 *   SCOPE: every file under src/ (since plan 04-03, DI-34), not only src/app.
 *   The src/app-only census could not see an INDIRECT reach — a src/lib/
 *   module that constructs the service-role client and is imported by a route.
 *   src/lib/audit.ts was exactly that, reachable from ten admin route files,
 *   and it was counted nowhere. The ESLint boundary in eslint.config.mjs was
 *   widened to the same scope in the same commit, so the two controls read the
 *   same thing.
 *
 * REQUIREMENT
 *   REFAC-05 — the import boundary that fails the build, plus the ratchet that
 *   lets it ship at error severity without the pre-existing callsites turning
 *   the lint step red. REFAC-09 / DI-34 / DI-31 (plan 04-03) — the widening
 *   to src/ and the CI wiring.
 *
 * INVOCATION
 *   node scripts/check-elevated-ratchet.mjs            # check
 *   node scripts/check-elevated-ratchet.mjs --write    # regenerate the list
 *
 *   Invoked BY PATH and never added to package.json. Since plan 04-03 it runs
 *   in CI as the "Elevated-callsite ratchet" step of the `ci` job in
 *   .github/workflows/ci.yml, so a pull request that grows the census fails.
 *
 *   `--write` is not a way to make a failing check pass. It was run exactly
 *   once after the boundary was written (plan 03-03) and exactly once more to
 *   absorb src/lib/audit.ts when the scope widened (plan 04-03), with the
 *   before/after diff recorded in that plan's evidence/boundary-widening.txt.
 *
 * DEPENDENCIES
 *   None. Node built-ins only — no package, no dev-dependency, nothing added
 *   to the lockfile.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const SCAN_DIR = join(REPO_ROOT, "src");
const ALLOWLIST = join(REPO_ROOT, "eslint.elevated-allowlist.mjs");

/**
 * THE CREDENTIAL'S TWO SANCTIONED HOMES ARE EXEMPT, AND THIS IS NOT A LOOSENING.
 *
 *   src/lib/supabase/         — where the service-role factory is DEFINED
 *                               (service.ts constructs the client from the key)
 *   src/server/db/elevated/   — the single sanctioned DOOR to it
 *                               (getElevatedClient(), with its REGISTRY.md)
 *
 * Neither is a reach INTO the credential; they are where it lives. Counting
 * them would put the credential's own definition on a list whose every entry
 * is supposed to be migrated to the door — and the door itself on it. Before
 * plan 04-03 neither was counted either, because neither is under src/app.
 * The ESLint boundary ignores exactly the same two prefixes.
 */
const SANCTIONED_HOMES = ["src/lib/supabase/", "src/server/db/elevated/"];

/** Only source files can import anything. REGISTRY.md and CSS are not code. */
const SOURCE_FILE = /\.[cm]?[jt]sx?$/;

/**
 * TEST FILES ARE EXCLUDED FROM THE CENSUS, AND THIS IS NOT A LOOSENING.
 *
 * The rule this ratchet exists to support is core `no-restricted-imports`,
 * which inspects ImportDeclaration and ExportNamedDeclaration nodes only. A
 * test file that names a module inside a `jest.mock()` CALL — a function
 * argument, not an import specifier — is correctly ignored by that rule.
 *
 *     jest.mock("@supabase/supabase-js", () => ({ … }));   // not an import
 *     jest.mock("@/lib/supabase/service", () => ({ … }));  // not an import
 *
 * The census below is `text.includes(marker)`, which cannot tell the two apart,
 * so before this filter it counted `src/app/auth/callback/route.test.ts` as a
 * live callsite that the allow-list did not hold — `committed=24 live=25
 * delta=1`, exit 1, with `npm run lint` green at 0 errors beside it. Two
 * controls disagreeing about what counts as a callsite is the defect; this
 * filter makes the census read what ESLint reads.
 *
 * Registered as deferred item D-19 by plan 03-06 and closed by plan 03-08 as a
 * census-only change. The committed allow-list was NOT regenerated — it is
 * byte-identical across the fix, asserted in
 * .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/ratchet-d19-fix.txt
 *
 * DO NOT "fix" this back. A test file cannot reach the service-role credential
 * at runtime in production; it can only mock it. The security property the
 * ratchet defends — that no SHIPPED file under src/app/** newly reaches the
 * RLS-bypassing client — is unaffected, because a `.test.ts` file is not
 * shipped. If a test file ever imports the service client for real, ESLint's
 * boundary rule catches it, which is the control that actually fails a build.
 */
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

// Plan 04-03 note on the block above: the census is no longer
// `text.includes(marker)` — it is the import-statement census below, which
// would not count a jest.mock() argument in any case. The skip stays because
// its closing reason still holds for all of src/: a test file is not shipped.
// The boundary rule is now @typescript-eslint/no-restricted-imports (the core
// rule plus `allowTypeImports`), which still inspects import and export
// declarations only.

// ─── What counts as a reach ───────────────────────────────────────────────────
//
// A file counts when it has a VALUE import or VALUE re-export whose specifier
// is the service module or the Supabase SDK package, or a DYNAMIC import() of
// the service module. That is what the ESLint boundary reports, stated in the
// census's terms:
//
//   @typescript-eslint/no-restricted-imports, allowTypeImports: true
//     static import / export-from / import-equals of either group   -> counts
//     `import type …`, `import { type A, type B }` (every specifier
//     inline-type), `export type { … } from`                         -> skipped
//     `export * from` and `export type * from`                        -> counts
//       (the rule reports every ExportAllDeclaration; so does this census)
//
//   no-restricted-syntax (the companion rule, plan 04-03 task 2)
//     import("…/lib/supabase/service")                                -> counts
//
// A type-only import cannot construct a client: it is erased at compile time.
// Before plan 04-03 the census was a substring match, which would have counted
// src/server/context.ts and src/server/authz/requireUser.ts — both
// `import type { User } from "@supabase/supabase-js"` — as elevated callers.
//
// The bare read of process.env.SUPABASE_SERVICE_ROLE_KEY is NOT counted here:
// the companion lint rule fails it, and every file that reads the key today
// also imports the SDK, which this census does count.

/** The service-role factory module: the `@/` alias or any relative path to it. */
function isServiceModule(spec) {
  const bare = spec.replace(/\.[cm]?[jt]sx?$/, "");
  return bare === "@/lib/supabase/service" || /(^|\/)lib\/supabase\/service$/.test(bare);
}

/** The raw SDK — the ESLint group `@supabase/supabase-js` also matches subpaths. */
function isSdk(spec) {
  return spec === "@supabase/supabase-js" || spec.startsWith("@supabase/supabase-js/");
}

const isRestricted = (spec) => isServiceModule(spec) || isSdk(spec);

/**
 * Static `import … from` / `export … from`, anchored at the start of a line so
 * that prose inside a docblock (lines starting with `*`) or a `//` comment
 * cannot match. The clause is limited to identifier, `*`, brace, comma and
 * whitespace characters, so the match cannot run across a statement.
 */
const STATIC_FROM =
  /^[ \t]*(import|export)\s+(type\s+)?([\w$*{},\s]*?)\s*from\s*["']([^"']+)["']/gm;

/** `import "spec";` — a side-effect import is a value import. */
const SIDE_EFFECT = /^[ \t]*import\s*["']([^"']+)["']/gm;

/** `import x = require("spec")` — TS import-equals; `import type x = …` is type-only. */
const IMPORT_EQUALS =
  /^[ \t]*(?:export\s+)?import\s+(type\s+)?[\w$]+\s*=\s*require\(\s*["']([^"']+)["']\s*\)/gm;

/** `import("spec")` anywhere in code. Comment lines are excluded below. */
const DYNAMIC = /\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

/** A braced clause every one of whose specifiers is written `type X`. */
function isAllInlineType(clause) {
  const m = clause.trim().match(/^\{([\s\S]*)\}$/);
  if (!m) return false;
  const specifiers = m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return specifiers.length > 0 && specifiers.every((s) => /^type\s+/.test(s));
}

/** Is the line holding `index` a comment line (`//…`, or a docblock `*` line)? */
function onCommentLine(text, index) {
  const start = text.lastIndexOf("\n", index) + 1;
  const line = text.slice(start, index).trimStart();
  return line.startsWith("//") || line.startsWith("*") || line.startsWith("/*");
}

/** Does this source text reach the service-role client, as the boundary defines it? */
function reachesElevated(text) {
  for (const m of text.matchAll(STATIC_FROM)) {
    const [, keyword, typeKw, clause, spec] = m;
    if (!isRestricted(spec)) continue;
    const isExportAll = keyword === "export" && /^\*/.test(clause.trim());
    if (isExportAll) return true;
    if (typeKw) continue;
    if (isAllInlineType(clause)) continue;
    return true;
  }
  for (const m of text.matchAll(SIDE_EFFECT)) {
    if (isRestricted(m[1])) return true;
  }
  for (const m of text.matchAll(IMPORT_EQUALS)) {
    if (!m[1] && isRestricted(m[2])) return true;
  }
  for (const m of text.matchAll(DYNAMIC)) {
    if (isServiceModule(m[1]) && !onCommentLine(text, m.index)) return true;
  }
  return false;
}

/** Every file under a directory, recursively, in a stable order. */
function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...walk(full));
    } else {
      found.push(full);
    }
  }
  return found;
}

/**
 * ESLint `files` entries are globs, and a Next.js dynamic segment like [id] is
 * read as a CHARACTER CLASS. Unescaped, such an entry matches nothing and the
 * file silently stays under the rule. 13 of the 24 entries the list held
 * before plan 04-03 are dynamic routes, so this is the majority case.
 */
function escapeGlob(p) {
  return p.replaceAll("[", "\\[").replaceAll("]", "\\]");
}

/** Re-derive the live census, escaped, sorted — comparable to the committed list. */
function liveCensus() {
  return walk(SCAN_DIR)
    .map((file) => ({ file, rel: relative(REPO_ROOT, file).split(sep).join("/") }))
    .filter(({ rel }) => SOURCE_FILE.test(rel))
    .filter(({ rel }) => !TEST_FILE.test(rel))
    .filter(({ rel }) => !SANCTIONED_HOMES.some((home) => rel.startsWith(home)))
    .filter(({ file }) => reachesElevated(readFileSync(file, "utf8")))
    .map(({ rel }) => escapeGlob(rel))
    .sort();
}

function renderAllowlist(entries) {
  const dynamic = entries.filter((p) => p.includes("[")).length;
  const rows = entries
    .map((p) => `  "${p.replaceAll("\\", "\\\\")}",`)
    .join("\n");

  return `/**
 * GENERATED — do not hand-edit.
 *
 * The shrink-only ratchet of legacy service-role callsites under src/**,
 * excluding the credential's two sanctioned homes, src/lib/supabase/ (where
 * the factory is defined) and src/server/db/elevated/ (the one door to it).
 *
 * Regenerate:
 *
 *     node scripts/check-elevated-ratchet.mjs --write
 *
 * An entry is a non-test source file with a VALUE import or VALUE re-export
 * of @/lib/supabase/service (or any relative path to it) or of
 * @supabase/supabase-js, or a dynamic import() of the service module. A
 * type-only import does not count: it cannot construct a client. This is
 * exactly what the ESLint boundary in eslint.config.mjs reports.
 *
 * THIS LIST MAY ONLY SHRINK. Every entry is a file that reaches the
 * RLS-bypassing service-role credential without going through
 * src/server/db/elevated/. Phases 4-6 delete rows as each route moves to the
 * seam; nothing may ever add one.
 * scripts/check-elevated-ratchet.mjs asserts that direction on every run, and
 * CI runs it on every pull request.
 *
 * ONE SANCTIONED GROWTH, ALREADY SPENT. When plan 04-03 widened both controls
 * from src/app/** to src/** (DI-34), the list was regenerated once and gained
 * exactly one entry: the module that defines logAdminAction, an elevated
 * caller that already existed and that neither control could see. Its
 * before/after diff is in
 * .planning/phases/04-slices-1-2-saved-events-rsvp-and-the-event-read-path/evidence/boundary-widening.txt
 *
 * BRACKETS MUST BE ESCAPED. ESLint \`files\` entries are globs, and a Next.js
 * dynamic segment like [id] is read as a CHARACTER CLASS matching one of 'i'
 * or 'd' — so an unescaped entry matches NOTHING and the file silently stays
 * under the rule. Measured on this tree: unescaped -> 12 errors leak through;
 * escaped -> 0. ${dynamic} of the ${entries.length} entries below are dynamic routes, so this is
 * the majority case, not an edge case.
 *
 * The header carries no timestamp on purpose: a generated file that
 * regenerates byte-for-byte is one a reviewer can verify. The date the
 * original census was taken is recorded in
 * .planning/phases/03-refactor-foundations-schema-truth-and-the-seam-kit/evidence/elevated-callsite-census.txt
 */
export const LEGACY_ELEVATED_CALLSITES = [
${rows}
];
`;
}

const live = liveCensus();

if (process.argv.includes("--write")) {
  writeFileSync(ALLOWLIST, renderAllowlist(live));
  console.log(`wrote ${live.length} entries to eslint.elevated-allowlist.mjs`);
  process.exit(0);
}

const module_ = await import(pathToFileURL(ALLOWLIST).href);
const committed = module_.LEGACY_ELEVATED_CALLSITES;

if (!Array.isArray(committed)) {
  console.error("FAIL: LEGACY_ELEVATED_CALLSITES is not an array");
  process.exit(1);
}

const added = live.filter((p) => !committed.includes(p));
const retired = committed.filter((p) => !live.includes(p));

console.log(`committed=${committed.length} live=${live.length} delta=${live.length - committed.length}`);

if (retired.length > 0) {
  console.log(`retired=${retired.length} (the list shrank — this is the intended direction)`);
  for (const p of retired) console.log(`  - ${p}`);
}

if (added.length > 0) {
  console.error("");
  console.error(`FAIL: ${added.length} callsite(s) are NOT in the committed allow-list:`);
  for (const p of added) console.error(`  + ${p}`);
  console.error("");
  console.error("A new file under src/** reaches the service-role client.");
  console.error("Route it through src/server/db/elevated/ and add a row to");
  console.error("src/server/db/elevated/REGISTRY.md. The allow-list may only shrink,");
  console.error("so do NOT regenerate it to make this pass.");
  process.exit(1);
}

console.log("PASS: the live census is a subset of the committed allow-list");
process.exit(0);

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
 * REQUIREMENT
 *   REFAC-05 — the import boundary that fails the build, plus the ratchet that
 *   lets it ship at error severity without the 24 pre-existing callsites
 *   turning the lint step red.
 *
 * INVOCATION
 *   node scripts/check-elevated-ratchet.mjs            # check
 *   node scripts/check-elevated-ratchet.mjs --write    # regenerate the list
 *
 *   Invoked BY PATH and never added to package.json. It is also deliberately
 *   NOT wired into .github/workflows/ci.yml in this plan: three plans in this
 *   phase touch that file and plan 03-06 owns the next edit to it, so adding a
 *   step here would put two plans in one file. The CI wiring lands later,
 *   alongside the first actual shrink.
 *
 * DEPENDENCIES
 *   None. Node built-ins only — no package, no dev-dependency, nothing added
 *   to the lockfile. The boundary itself uses core `no-restricted-imports`
 *   rather than an import-boundary plugin for exactly the same reason.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const APP_DIR = join(REPO_ROOT, "src", "app");
const ALLOWLIST = join(REPO_ROOT, "eslint.elevated-allowlist.mjs");

/**
 * The two markers that define a service-role callsite. These are the same two
 * alternatives the documented producing command greps for:
 *
 *     grep -rl "supabase/service\|@supabase/supabase-js" src/app/
 */
const MARKERS = ["supabase/service", "@supabase/supabase-js"];

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
 * file silently stays under the rule. 13 of the 24 current entries are dynamic
 * routes, so this is the majority case.
 */
function escapeGlob(p) {
  return p.replaceAll("[", "\\[").replaceAll("]", "\\]");
}

/** Re-derive the live census, escaped, sorted — comparable to the committed list. */
function liveCensus() {
  return walk(APP_DIR)
    .filter((file) => !TEST_FILE.test(file))
    .filter((file) => {
      const text = readFileSync(file, "utf8");
      return MARKERS.some((marker) => text.includes(marker));
    })
    .map((file) => escapeGlob(relative(REPO_ROOT, file).split(sep).join("/")))
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
 * The shrink-only ratchet of legacy service-role callsites under src/app/**.
 *
 * Regenerate:
 *
 *     node scripts/check-elevated-ratchet.mjs --write
 *
 * which is the committed form of this primitive:
 *
 *     grep -rl "supabase/service\\\\|@supabase/supabase-js" src/app/ \\\\
 *       | sed 's|\\\\[|\\\\\\\\[|g; s|\\\\]|\\\\\\\\]|g' | sort
 *
 * THIS LIST MAY ONLY SHRINK. Every entry is a file that reaches the
 * RLS-bypassing service-role credential without going through
 * src/server/db/elevated/. Phases 4-6 delete rows as each route moves to the
 * seam; nothing may ever add one.
 * scripts/check-elevated-ratchet.mjs asserts that direction on every run.
 *
 * BRACKETS MUST BE ESCAPED. ESLint \`files\` entries are globs, and a Next.js
 * dynamic segment like [id] is read as a CHARACTER CLASS matching one of 'i'
 * or 'd' — so an unescaped entry matches NOTHING and the file silently stays
 * under the rule. Measured on this tree: unescaped -> 12 errors leak through;
 * escaped -> 0. ${dynamic} of the ${entries.length} entries below are dynamic routes, so this is
 * the majority case, not an edge case.
 *
 * The header carries no timestamp on purpose: a generated file that
 * regenerates byte-for-byte is one a reviewer can verify. The date this census
 * was taken is recorded in
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
  console.error("A new file under src/app/** reaches the service-role client.");
  console.error("Route it through src/server/db/elevated/ and add a row to");
  console.error("src/server/db/elevated/REGISTRY.md. The allow-list may only shrink,");
  console.error("so do NOT regenerate it to make this pass.");
  process.exit(1);
}

console.log("PASS: the live census is a subset of the committed allow-list");
process.exit(0);

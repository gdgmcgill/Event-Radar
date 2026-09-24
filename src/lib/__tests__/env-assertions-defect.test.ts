/**
 * DEFECT characterization — F-003 (config half: process.env non-null assertions)
 *
 * Subject: every `process.env.<NAME>!` member access in production source
 * under `src/` (test files and `__tests__/` directories excluded).
 *
 * The defect: a `!` on an environment read tells the compiler the variable is
 * bound and tells the runtime nothing. When the variable is absent the
 * Supabase factory receives `undefined` and fails later, far from the cause,
 * or (in the proxy's sibling ring, F-003) the auth check is skipped. REFAC-11
 * replaces these reads with validated accessors in `src/lib/env.ts`.
 *
 * What this file is and is not:
 *   It is a census. It asserts the exact list of `file:VARIABLE` pairs that
 *   carry a `!` today, duplicates included, so a new assertion added anywhere
 *   turns it red, and so does each one the refactor removes. The removing
 *   commit edits the expected list below and records the move in
 *   `evidence/defect-ledger.md`. The list was derived from the tree with
 *   `command grep -rnoE 'process\.env\.[A-Z_]+!' src` (15 occurrences, equal
 *   to the before-floor census), and that output sits next to it in
 *   `evidence/slice-3-characterization-ring.txt`.
 *
 * Registered as F-003 (Medium) in .planning/audit/findings.json. Closes in
 * Phase 5.
 *
 * Status: OPEN — the expected set shrinks in 05-04 and empties in 05-05
 *
 * The census only reads files. It modifies nothing under `src/`.
 */

import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const SRC_DIR = path.join(REPO_ROOT, "src");

/** `process.env.UPPER_SNAKE` immediately followed by the non-null `!` (not `!=`). */
const ENV_ASSERTION = /process\.env\.([A-Z][A-Z0-9_]*)!(?!=)/g;

function productionSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      out.push(...productionSources(full));
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.tsx?$/.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

function census(): string[] {
  const pairs: string[] = [];
  for (const file of productionSources(SRC_DIR)) {
    const rel = path.relative(REPO_ROOT, file).split(path.sep).join("/");
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(ENV_ASSERTION)) {
      pairs.push(`${rel}:${match[1]}`);
    }
  }
  return pairs.sort();
}

/**
 * Today's set, after 05-04 (F-003 census step one). Sorted, duplicates kept:
 * the callback asserts NEXT_PUBLIC_SUPABASE_URL twice (route.ts:61 and :123).
 * 05-04 removed 11 pairs: the three Supabase factories and the sign-out route
 * now read through the validated readers in src/lib/env.ts, and
 * src/app/api/auth-debug/route.ts was deleted (F-027). The measured 05-01
 * list of 15 is in evidence/defect-ledger.md. 05-05 empties this list.
 */
const EXPECTED_TODAY = [
  "src/app/auth/callback/route.ts:NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "src/app/auth/callback/route.ts:NEXT_PUBLIC_SUPABASE_URL",
  "src/app/auth/callback/route.ts:NEXT_PUBLIC_SUPABASE_URL",
  "src/app/auth/callback/route.ts:SUPABASE_SERVICE_ROLE_KEY",
];

describe("process.env non-null assertions under src/ (DEFECT — F-003; OPEN until 05-05)", () => {
  it("F-003: the census equals today's 4 file:VARIABLE pairs exactly", () => {
    expect(census()).toEqual(EXPECTED_TODAY);
  });

  it("F-003: the census walks production source only (sanity: it finds the Supabase factories)", () => {
    const files = productionSources(SRC_DIR).map((f) =>
      path.relative(REPO_ROOT, f).split(path.sep).join("/")
    );
    expect(files).toContain("src/lib/supabase/server.ts");
    expect(files.some((f) => /\.test\.tsx?$/.test(f))).toBe(false);
    expect(files.some((f) => f.includes("/__tests__/"))).toBe(false);
  });
});

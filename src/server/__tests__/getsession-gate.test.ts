/**
 * PRESERVE characterization gate — REFAC-11 clause 1: getUser() at every authorization decision
 *
 * Subject: every production source file under `src/` (test files and
 * `__tests__/` directories excluded).
 *
 * Why: `auth.getSession()` reads the session from the cookie without asking
 * the auth server to verify it, so it must never carry an authorization
 * decision on the server. `.planning/audit/authz/getsession-register.md`
 * (AUDIT-09) found exactly one server call, `src/app/api/health/route.ts`,
 * and it is non-gating: it reports session presence in a health payload and
 * decides nothing. That route is REFAC-22's, in Phase 6.
 *
 * Tests cover:
 *   - the set of files containing a `getSession(` call is exactly
 *     `["src/app/api/health/route.ts"]`, so a new call anywhere turns this red
 *   - the two authorization seams, `src/server/context.ts` and `src/proxy.ts`,
 *     each call `auth.getUser(`
 *
 * This gate holds before and after the whole of Phase 5: no plan in the phase
 * adds a `getSession(` call or removes either `getUser(` call. If Phase 6
 * removes the health route's call, the expected set becomes empty in that
 * commit.
 *
 * The gate only reads files. It modifies nothing under `src/`.
 */

import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const SRC_DIR = path.join(REPO_ROOT, "src");

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

function rel(file: string): string {
  return path.relative(REPO_ROOT, file).split(path.sep).join("/");
}

function read(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

describe("session accessor gate (PRESERVE — REFAC-11 clause 1)", () => {
  it("the only production file calling getSession( is the non-gating api/health route", () => {
    const callers = productionSources(SRC_DIR)
      .filter((file) => fs.readFileSync(file, "utf8").includes("getSession("))
      .map(rel)
      .sort();

    expect(callers).toEqual(["src/app/api/health/route.ts"]);
  });

  it.each(["src/server/context.ts", "src/proxy.ts"])(
    "%s verifies the session with auth.getUser(",
    (file) => {
      expect(read(file)).toContain("auth.getUser(");
    }
  );
});

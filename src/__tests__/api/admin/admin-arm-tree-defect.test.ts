/**
 * DEFECT characterization — F-058: the admin arm table against the tree,
 * once the admin handlers wear `withRoute` (plan 06-13, REFAC-20, DEC-73)
 *
 * MOVED OUT OF PRESERVE. `admin-guard-characterization.test.ts` P0 compared
 * `ADMIN_ARMS` with the tree by reading `export async function <VERB>` from
 * each admin route file (and `recommendations/analytics`, `recommendations/
 * batch`). F-058's fix changes that text: an adopted handler is declared
 * `export const <VERB> = withRoute({ cache, action }, async (…) => …)`, so the
 * PRESERVE regex finds no verb and the comparison cannot hold. The table,
 * the length (35) and the uniqueness stay pinned in the PRESERVE file; the
 * tree comparison moved here with a defect-ledger row (06-13), under the
 * five-step protocol.
 *
 * What is pinned:
 *   T0  the table equals the tree, reading both export forms, so the arm list
 *       stays complete while 06-14 adopts the two recommendations files;
 *   T1  every admin arm is declared through `withRoute` with the private
 *       class (the fixed shape: red against the pre-06-13 admin sources,
 *       which declare `export async function`).
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { M2_ARMS } from "../m2RouteArms";
import { ADMIN_ARMS } from "./adminArmTable";

const API_DIR = join(process.cwd(), "src", "app", "api");
const VERBS = "GET|POST|PUT|PATCH|DELETE";

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? routeFiles(join(dir, entry.name))
      : entry.name === "route.ts"
        ? [join(dir, entry.name)]
        : []
  );
}

const routeOf = (file: string) =>
  relative(API_DIR, file).split("\\").join("/").replace(/\/route\.ts$/, "");

const ADMIN_FILES = routeFiles(join(API_DIR, "admin"));

/** "<route> <VERB>" for every HTTP export, in either declaration form. */
function treeArms(): string[] {
  const files = [
    ...ADMIN_FILES,
    join(API_DIR, "recommendations", "analytics", "route.ts"),
    join(API_DIR, "recommendations", "batch", "route.ts"),
  ];
  const ids: string[] = [];
  const either = new RegExp(
    `export\\s+(?:async\\s+function|const)\\s+(${VERBS})\\b`,
    "g"
  );
  for (const file of files) {
    for (const match of readFileSync(file, "utf8").matchAll(either)) {
      ids.push(`${routeOf(file)} ${match[1]}`);
    }
  }
  return ids.sort();
}

describe("T0 (F-058): the admin arm table equals the tree, in either export form", () => {
  it("holds exactly the exported verbs of the admin family (35 arms)", () => {
    expect([...ADMIN_ARMS.map((arm) => arm.id), ...M2_ARMS.filter(a => a.admin).map(a => `${a.route} ${a.verb}`)].sort()).toEqual(treeArms());
    expect(ADMIN_ARMS).toHaveLength(35);
  });
});

describe("T1 (F-058 fixed): every admin arm wears withRoute with the private class", () => {
  const adminArms = [...ADMIN_ARMS.filter((arm) => arm.id.startsWith("admin/")), ...M2_ARMS.filter(a => a.admin).map(a => ({ id: `${a.route} ${a.verb}` }))];

  it("covers the 40 admin arms", () => {
    expect(adminArms).toHaveLength(40);
  });

  it.each(adminArms.map((arm): [string] => [arm.id]))("%s", (id) => {
    const [route, verb] = id.split(" ");
    const source = readFileSync(join(API_DIR, route, "route.ts"), "utf8");
    expect(source).toMatch(
      new RegExp(`export const ${verb} = withRoute\\(\\{ cache: "private", action: "[a-z ]+" \\}`)
    );
    expect(source).not.toMatch(new RegExp(`export\\s+async\\s+function\\s+${verb}\\b`));
  });
});

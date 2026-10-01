/**
 * DEFECT characterization — F-058: the write-handler table against the tree,
 * once the write handlers wear `withRoute` (plan 06-13, REFAC-20, DEC-73)
 *
 * MOVED OUT OF PRESERVE. `write-handlers-characterization.test.ts` P0
 * compared `WRITE_ARMS` with every exported POST, PUT, PATCH and DELETE under
 * `src/app/api` (outside `admin/`, `cron/` and `recommendations/batch/`),
 * read as `export (async) function <VERB>`. F-058's fix changes that text: an
 * adopted handler is declared `export const <VERB> = withRoute({ cache,
 * action }, async (…) => …)`, so the PRESERVE regex stops seeing the arm and
 * the comparison cannot hold. The uniqueness and the count (39) stay pinned
 * in the PRESERVE file; the tree comparison moved here with a defect-ledger
 * row (06-13), under the five-step protocol.
 *
 * What is pinned:
 *   T0  the table equals the tree, reading both export forms, so an arm added
 *       without a descriptor still turns a suite red while 06-14 adopts the
 *       rest of the tree;
 *   T1  every write arm in the families 06-13 adopted (clubs,
 *       organizer-requests) is declared through `withRoute` with the private
 *       class (the fixed shape: red against the pre-06-13 sources).
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { M2_ARMS } from "../m2RouteArms";
import { WRITE_ARMS } from "./writeHandlerTable";

const API_DIR = join(process.cwd(), "src", "app", "api");
const EXCLUDED = ["admin/", "cron/", "recommendations/batch/"];
const WRITE_VERB =
  /export\s+(?:(?:async\s+)?function|const)\s+(POST|PUT|PATCH|DELETE)\b/g;

function enumerateWriteArms(): string[] {
  const arms: string[] = [];
  for (const entry of readdirSync(API_DIR, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name !== "route.ts") continue;
    const file = join(entry.parentPath, entry.name);
    const route = relative(API_DIR, entry.parentPath).split(sep).join("/");
    if (EXCLUDED.some((prefix) => `${route}/`.startsWith(prefix))) continue;
    for (const match of readFileSync(file, "utf8").matchAll(WRITE_VERB)) {
      arms.push(`${route} ${match[1]}`);
    }
  }
  return arms.sort();
}

describe("T0 (F-058): the write-arm table equals the tree, in either export form", () => {
  it("every write arm under src/app/api has exactly one descriptor (39)", () => {
    const ids = WRITE_ARMS.map((arm) => arm.id);
    expect([...ids, ...M2_ARMS.filter(a => a.write).map(a => `${a.route} ${a.verb}`)].sort()).toEqual(enumerateWriteArms());
    expect(ids).toHaveLength(39);
  });
});

/** The write arms whose files 06-13 adopted. */
const ADOPTED_FAMILIES = /^(clubs|organizer-requests)(\/|\s)/;

describe("T1 (F-058 fixed): the 06-13 write arms wear withRoute with the private class", () => {
  const adopted = WRITE_ARMS.filter((arm) => ADOPTED_FAMILIES.test(arm.id));

  it("covers the 13 club and organizer-request write arms", () => {
    expect(adopted).toHaveLength(13);
  });

  it.each(adopted.map((arm): [string] => [arm.id]))("%s", (id) => {
    const [route, verb] = id.split(" ");
    const source = readFileSync(join(API_DIR, route, "route.ts"), "utf8");
    expect(source).toMatch(
      new RegExp(`export const ${verb} = withRoute\\(\\{ cache: "private", action: "[^"]+" \\}`)
    );
    expect(source).not.toMatch(new RegExp(`export\\s+async\\s+function\\s+${verb}\\b`));
  });
});

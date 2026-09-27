/**
 * DEFECT characterization — F-054: /docs publishes the API description to
 * anyone, with no gate (plan 06-07 pins it; plan 06-17 adds
 * `src/app/docs/layout.tsx` through `requireAdminPage`, research § H)
 *
 * Measured at f550de9 by reading the tree. The admin pages are gated by
 * `src/app/admin/layout.tsx` (`getRequestContext` → `hasRole(profile,
 * "admin")`, else `redirect("/")`). `src/app/docs/` has no layout at all, its
 * page imports no guard, and the proxy's PROTECTED_ROUTES does not name
 * /docs, so nothing between the request and `getApiDocs()` asks who is
 * reading.
 *
 * What is pinned:
 *   - G1 `src/app/docs/layout.tsx` does not exist; the directory holds only
 *     `page.tsx`;
 *   - G2 `src/app/docs/page.tsx` imports no guard (no request context, no
 *     role check, no redirect or notFound, no `requireAdminPage`) and calls
 *     `getApiDocs()`;
 *   - G3 `/docs` is not in the proxy's PROTECTED_ROUTES;
 *   - G4 the control: `src/app/admin/layout.tsx` does carry the gate shape
 *     G2 looks for, so G2 can see a guard when one exists.
 *
 * When 06-17 lands, G1 and G2 MOVE (a docs layout with the admin gate), with
 * a defect-ledger row citing F-054. G3 may stay: the page-level gate is the
 * fix, the proxy list is advisory.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const APP = join(process.cwd(), "src", "app");
const GUARD =
  /getRequestContext|createRequestContext|requireAdminPage|hasRole|isAdmin|redirect\(|notFound\(|from "next\/navigation"/;

function read(...parts: string[]): string {
  return readFileSync(join(APP, ...parts), "utf8");
}

describe("/docs has no gate", () => {
  it("G1 src/app/docs has no layout, only page.tsx", () => {
    expect(existsSync(join(APP, "docs", "layout.tsx"))).toBe(false);
    expect(readdirSync(join(APP, "docs")).sort()).toEqual(["page.tsx"]);
  });

  it("G2 the page imports no guard and renders getApiDocs()", () => {
    const page = read("docs", "page.tsx");
    expect(page).not.toMatch(GUARD);
    expect(page).toMatch(/getApiDocs\(\)/);
  });

  it("G3 the proxy does not protect /docs", () => {
    const proxy = readFileSync(join(process.cwd(), "src", "proxy.ts"), "utf8");
    const list = proxy.match(/PROTECTED_ROUTES\s*=\s*\[([^\]]*)\]/)?.[1] ?? "";
    expect(list.length).toBeGreaterThan(0);
    expect(list).not.toMatch(/["']\/docs["']/);
  });

  it("G4 control: the admin layout carries the gate shape G2 looks for", () => {
    expect(read("admin", "layout.tsx")).toMatch(GUARD);
  });
});

/**
 * DEFECT characterization — F-054: /docs published the API description to
 * anyone, with no gate (plan 06-07 pinned it; plan 06-17 FIXED it with
 * `src/app/docs/layout.tsx` through `requireAdminPage`, DEC-79)
 *
 * Measured at f550de9 by reading the tree: `src/app/docs/` had no layout, its
 * page imported no guard, and the proxy's PROTECTED_ROUTES did not name
 * /docs, so nothing between the request and `getApiDocs()` asked who was
 * reading.
 *
 * What is pinned now (G1 and G2 MOVED in 06-17 under the ledger protocol,
 * defect-ledger rows citing F-054):
 *   - G1 `src/app/docs/layout.tsx` exists beside `page.tsx` and calls
 *     `requireAdminPage("/")` before rendering its children;
 *   - G2 driven: the docs layout redirects an anonymous caller, a signed-in
 *     student and a banned admin to "/", and renders its children for an
 *     active admin; the page itself is unchanged and still calls
 *     `getApiDocs()` (the gate is the layout's);
 *   - G3 `/docs` is not in the proxy's PROTECTED_ROUTES (unchanged: the
 *     page-level gate is the fix, the proxy list is advisory);
 *   - G4 the control: `src/app/admin/layout.tsx` carries the gate shape;
 *   - G5 (added in 06-17) the /health layout carries the same gate.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";

const redirectMock = jest.fn((to: string): never => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});
jest.mock("next/navigation", () => ({
  redirect: (to: string) => redirectMock(to),
}));

let caller: { user: unknown; profile: unknown };
jest.mock("@/server/context", () => ({
  getRequestContext: async () => ({
    supabase: null,
    requestId: "req-1",
    ...caller,
  }),
}));

const APP = join(process.cwd(), "src", "app");
const GUARD =
  /getRequestContext|createRequestContext|requireAdminPage|hasRole|isAdmin|redirect\(|notFound\(|from "next\/navigation"/;
const ADMIN_PAGE_GATE = /await requireAdminPage\("\/"\)/;

function read(...parts: string[]): string {
  return readFileSync(join(APP, ...parts), "utf8");
}

const USER = { id: "user-1", email: "someone@mail.mcgill.ca" };
function profile(roles: string[], banned_at: string | null = null) {
  return { id: USER.id, roles, onboarding_completed: true, banned_at, ban_expires_at: null };
}

beforeEach(() => redirectMock.mockClear());

describe("/docs is admin-only (F-054 fixed by 06-17)", () => {
  it("G1 src/app/docs has a layout beside page.tsx, and it calls requireAdminPage(\"/\")", () => {
    expect(existsSync(join(APP, "docs", "layout.tsx"))).toBe(true);
    expect(readdirSync(join(APP, "docs")).sort()).toEqual(["layout.tsx", "page.tsx"]);
    const layout = read("docs", "layout.tsx");
    expect(layout).toMatch(/from "@\/server\/authz\/requireAdminPage"/);
    expect(layout).toMatch(ADMIN_PAGE_GATE);
  });

  it.each([
    ["anonymous", { user: null, profile: null }],
    ["a signed-in student", { user: USER, profile: profile(["user"]) }],
    ["a banned admin", { user: USER, profile: profile(["user", "admin"], "2026-01-01T00:00:00.000Z") }],
  ])("G2 the docs layout redirects %s to \"/\"", async (_label, who) => {
    caller = who;
    const { default: DocsLayout } = await import("@/app/docs/layout");

    await expect(DocsLayout({ children: "SPEC" })).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("G2 the docs layout renders its children for an active admin; the page still renders getApiDocs()", async () => {
    caller = { user: USER, profile: profile(["user", "admin"]) };
    const { default: DocsLayout } = await import("@/app/docs/layout");

    const element = (await DocsLayout({ children: "SPEC" })) as ReactElement<{ children: unknown }>;
    expect(element.props.children).toBe("SPEC");
    expect(redirectMock).not.toHaveBeenCalled();
    expect(read("docs", "page.tsx")).toMatch(/getApiDocs\(\)/);
  });

  it("G3 the proxy does not protect /docs", () => {
    const proxy = readFileSync(join(process.cwd(), "src", "proxy.ts"), "utf8");
    const list = proxy.match(/PROTECTED_ROUTES\s*=\s*\[([^\]]*)\]/)?.[1] ?? "";
    expect(list.length).toBeGreaterThan(0);
    expect(list).not.toMatch(/["']\/docs["']/);
  });

  it("G4 control: the admin layout carries the gate shape", () => {
    expect(read("admin", "layout.tsx")).toMatch(GUARD);
  });

  it("G5 the /health layout carries the same gate (DEC-79)", () => {
    expect(read("health", "layout.tsx")).toMatch(ADMIN_PAGE_GATE);
  });
});

/**
 * admin-guard.spec.ts — the admin guard on `/api/admin/*`, through a real
 * browser session, a production build and the seeded local database.
 *
 * Phase 05-slices-3-5-auth-club-authorization-admin-containment · plan 05-12
 *
 * WHAT IS PINNED, AND WHERE IT MOVES
 *   - FIXED F-061 (05-13): an anonymous caller at `GET /api/admin/stats` gets
 *     401 `{"error":"Unauthorized"}`, as the contract (`endpoints.json`) says.
 *     Before 05-13 it got 403 `{"error":"Forbidden"}` from the admin-verify
 *     helper; 05-13 replaced the helper with `requireRole(ctx, "admin")` and
 *     flipped this test.
 *   - PRESERVE: `onboarded_student` gets 403 `{"error":"Forbidden"}`, and the
 *     admin gets 200. Both survive 05-13 unchanged.
 *
 * The unit net (`src/__tests__/api/admin/admin-guard-*.test.ts`) pins all 35
 * arms against fakes. This spec proves one arm against the real stack, the
 * real proxy (which lets `/api/admin/*` through to the handler) and the real
 * cookie session.
 *
 * READ-ONLY. `admin/stats` is a GET that writes nothing. This spec never calls
 * `admin/calculate-popularity`: it writes popularity scores that other specs
 * read (T-05-12-03).
 */

import { expect, test, type APIResponse } from "@playwright/test";

import { storageStateFor } from "../fixtures";

const STATS = "/api/admin/stats";

async function expectJson(
  res: APIResponse,
  status: number,
  body: unknown
): Promise<void> {
  expect(res.status()).toBe(status);
  expect(res.headers()["content-type"] ?? "").toContain("application/json");
  expect(await res.json()).toEqual(body);
}

test.describe("an anonymous caller", () => {
  test("FIXED F-061: anonymous admin call answers 401", async ({
    playwright,
    baseURL,
  }) => {
    // A fresh request context with no storage state: no cookie, no session.
    const anonymous = await playwright.request.newContext({ baseURL });
    try {
      await expectJson(await anonymous.get(STATS), 401, {
        error: "Unauthorized",
      });
    } finally {
      await anonymous.dispose();
    }
  });
});

test.describe("an onboarded student", () => {
  test.use({ storageState: storageStateFor("onboarded_student") });

  test("PRESERVE: a non-admin gets 403 Forbidden", async ({ page }) => {
    await expectJson(await page.request.get(STATS), 403, { error: "Forbidden" });
  });
});

test.describe("an admin", () => {
  test.use({ storageState: storageStateFor("admin") });

  test("PRESERVE: the admin gets 200 with the stats body", async ({ page }) => {
    const res = await page.request.get(STATS);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.totalEvents).toBe("number");
    expect(typeof body.totalUsers).toBe("number");
  });
});

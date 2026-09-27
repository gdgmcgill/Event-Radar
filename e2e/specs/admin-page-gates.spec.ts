/**
 * admin-page-gates.spec.ts — `/docs` and `/health` are admin-only pages.
 *
 * Phase 06-slices-6-7-async-edge-contracts-caching-observability · plan 06-17
 * (F-054, DEC-79)
 *
 * Both pages sit behind a server layout calling `requireAdminPage("/")`. The
 * proxy does not list either path (the page gate is the fix; the proxy ring
 * is advisory), so what these rows observe is the layout's decision:
 *   - an anonymous caller and the onboarded student end on "/";
 *   - the admin gets 200 and the page renders.
 *
 * The banned-admin arm is pinned by the unit suites
 * (`src/server/__tests__/requireAdminPage.test.ts`,
 * `src/__tests__/pages/docs-gate-defect.test.ts`): the seed has no banned
 * admin persona, and adding one would move rows other specs read.
 *
 * READ-ONLY.
 */

import { expect, test } from "@playwright/test";

import { storageStateFor } from "../fixtures";

const PAGES = ["/docs", "/health"] as const;

for (const path of PAGES) {
  test.describe(`${path}, anonymous`, () => {
    test(`${path} redirects an anonymous caller to /`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL((url) => url.pathname === "/");
    });
  });

  test.describe(`${path}, onboarded student`, () => {
    test.use({ storageState: storageStateFor("onboarded_student") });

    test(`${path} redirects a signed-in non-admin to /`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL((url) => url.pathname === "/");
    });
  });
}

test.describe("admin", () => {
  test.use({ storageState: storageStateFor("admin") });

  test("/docs answers 200 and renders the API description", async ({ page }) => {
    const res = await page.goto("/docs");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL((url) => url.pathname === "/docs");
    await expect(page.getByText("Event Radar API Documentation").first()).toBeVisible();
  });

  test("/health answers 200 and renders the dashboard", async ({ page }) => {
    const res = await page.goto("/health");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL((url) => url.pathname === "/health");
    await expect(page.getByRole("heading", { name: "System Health" })).toBeVisible();
  });
});

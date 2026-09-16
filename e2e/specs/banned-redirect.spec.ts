/**
 * banned-redirect.spec.ts — a banned user is turned away from a protected path.
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
 *
 * THIS IS THE ONE SPEC IN THE PHASE THAT CLOSES A CARRIED-FORWARD RESIDUAL.
 *   `02-SECURITY.md § Residuals` records the ban-check row as un-assertable:
 *   the behaviour could not be tested because no seeded banned session existed
 *   to test it with. That is precisely what plan 03-07's seed supplies, and this
 *   file is the assertion Phase 2 could not make.
 *
 * IT ASSERTS THE REDIRECT TARGET, NOT THE RENDERED PAGE.
 *   `scripts/smoke.sh`'s method contract says it in as many words: "No -L
 *   anywhere. Rows 5 and 6 assert a redirect; following it would turn the
 *   assertion into a test of the landing page instead of the auth ring." The
 *   same discipline one tier up — what is under test is `src/proxy.ts`'s ban
 *   branch, not `/banned`'s markup. So this spec looks at the URL and says
 *   nothing whatever about what is on the page it arrived at.
 *
 * THE THIRD CASE IS THE ONE WORTH HAVING.
 *   `suspension_expired` has `banned_at` SET and an expiry in the past. It looks
 *   banned in the table. The ring must let it through, and an implementation
 *   that checked only `banned_at` would pass the first two assertions and fail
 *   this one.
 */

import { expect, test } from "@playwright/test";

import { BANNED_PATH, protectedRoutes, storageStateFor } from "../fixtures";

// Re-derived from src/proxy.ts at load time, not transcribed. See fixtures.ts.
const A_PROTECTED_PATH = protectedRoutes()[0];

test.describe("a permanently banned user", () => {
  test.use({ storageState: storageStateFor("banned_permanent") });

  test("is redirected away from a protected path, to the ban page", async ({ page }) => {
    await page.goto(A_PROTECTED_PATH);

    expect(
      new URL(page.url()).pathname,
      "the ban ring must divert a banned session before the protected page renders"
    ).toBe(BANNED_PATH);
  });
});

test.describe("a user whose suspension is still running", () => {
  test.use({ storageState: storageStateFor("suspended_active") });

  test("is redirected away from a protected path, to the ban page", async ({ page }) => {
    await page.goto(A_PROTECTED_PATH);

    expect(
      new URL(page.url()).pathname,
      "an unexpired ban_expires_at must be treated exactly like a permanent ban"
    ).toBe(BANNED_PATH);
  });
});

test.describe("a user whose suspension has expired", () => {
  test.use({ storageState: storageStateFor("suspension_expired") });

  test("reaches the protected path, because banned_at alone is not a ban", async ({ page }) => {
    await page.goto(A_PROTECTED_PATH);

    expect(
      new URL(page.url()).pathname,
      "banned_at is set on this row; the expiry is in the past, so the ring must let it through"
    ).toBe(A_PROTECTED_PATH);
  });
});

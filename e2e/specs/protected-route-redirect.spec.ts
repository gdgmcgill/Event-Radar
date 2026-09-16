/**
 * protected-route-redirect.spec.ts — the authentication ring, end to end.
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
 *
 * WHAT THIS CLOSES. `02-REVIEW.md` finding WR-04: Phase 2's `proxy.test.ts`
 * asserts only `config.matcher`, so "deleting the redirect block at
 * proxy.ts:115-121 entirely leaves this suite green." No unit test covers the
 * redirect at all. This file covers it at the end-to-end tier, against the
 * running application, where deleting that block turns every assertion below
 * red.
 *
 * THE LIST IS RE-DERIVED, NOT TRANSCRIBED. The project instructions name
 * `src/proxy.ts` as the ONLY authority for `PROTECTED_ROUTES` and warn against
 * trusting a copy — `src/proxy.test.ts` holds a transcription that could drift.
 * `fixtures.protectedRoutes()` parses the source at load time, so if a path is
 * added to the ring tomorrow this spec starts asserting on it without being
 * edited, and if one is removed the assertion disappears with it.
 *
 * It asserts the redirect TARGET, including the `next` parameter, because
 * carrying the intended destination through the sign-in prompt is the part
 * users notice when it breaks.
 */

import { expect, test } from "@playwright/test";

import { protectedRoutes, signInRedirectFor, storageStateFor } from "../fixtures";

const PROTECTED = protectedRoutes();

test.describe("an anonymous visitor", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("is redirected from every protected path to the sign-in prompt, carrying the destination", async ({
    page,
  }) => {
    expect(PROTECTED.length, "the ring must guard at least one path").toBeGreaterThan(0);

    // Accumulate rather than abort on the first failure — smoke.sh's convention,
    // and the reason it can report "rows 5 and 8 failed" instead of only row 5.
    const failures: string[] = [];

    for (const route of PROTECTED) {
      await page.goto(route);
      const actual = page.url().replace("http://127.0.0.1:3000", "");
      const expected = signInRedirectFor(route);
      if (actual !== expected) failures.push(`${route}: expected ${expected}, got ${actual}`);
    }

    expect(failures, failures.join(" | ")).toEqual([]);
  });
});

test.describe("a signed-in student", () => {
  test.use({ storageState: storageStateFor("onboarded_student") });

  test("reaches every protected path without a redirect", async ({ page }) => {
    const failures: string[] = [];

    for (const route of PROTECTED) {
      await page.goto(route);
      const landed = new URL(page.url()).pathname;
      // `/invites` has no index page of its own — the ring guards it, the router
      // has only `/invites/[token]` — so it is guarded-then-404, which is still
      // "not redirected to the sign-in prompt".
      if (page.url().includes("signin=required")) {
        failures.push(`${route}: redirected to the sign-in prompt while signed in (landed ${landed})`);
      }
    }

    expect(failures, failures.join(" | ")).toEqual([]);
  });
});

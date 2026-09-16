/**
 * club-owner-surfaces.spec.ts — a club owner's own surfaces.
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
 *
 * Re-confirms the Validated workflow from PROJECT.md:
 *   "Club organizers create and edit clubs, post events, invite members by
 *    McGill email, manage member roles, and switch between multiple clubs"
 *   — recorded there as contradicted by Phase 1 evidence (F-016). This spec
 *   asserts the read surfaces only; it makes no claim about the parts F-016
 *   names, and the harness note says so.
 *
 * `/my-clubs` IS A ROUTER, NOT A PAGE. `src/app/my-clubs/page.tsx` redirects: to
 * `/my-clubs/<id>` for exactly one membership, and to `/clubs?tab=my-clubs` for
 * two or more. The seeded club owner belongs to TWO clubs (the approved one and
 * the pending one), so the second branch is the one under test here — and the
 * redirect itself is part of the behaviour worth preserving.
 *
 * THAT REDIRECT IS A CLIENT-SIDE ONE, AND THE DISTINCTION MATTERS TO A TEST.
 * `redirect()` from a streaming Server Component does not produce a 3xx: the
 * response is 200, the target is encoded in the RSC payload as NEXT_REDIRECT, and
 * the router performs the navigation after hydration. `page.goto()` therefore
 * RESOLVES ON /my-clubs, and a spec that read `page.url()` immediately — as the
 * first version of this one did — sees the pre-redirect URL and fails. Waiting
 * for the URL is not a workaround; it is what "the app redirected me" means here.
 *
 * THE CROSS-CLUB PERSONA IS THE CONTROL. `cross_club_attacker` belongs only to a
 * different club, so its dashboard must not show the approved club's name. A
 * membership query that ignored `user_id` would pass every assertion above and
 * fail that one.
 */

import { expect, test } from "@playwright/test";

import { IDS, storageStateFor } from "../fixtures";

test.describe("the club owner", () => {
  test.use({ storageState: storageStateFor("club_owner") });

  test("is routed from /my-clubs to the multi-club surface and sees the approved club", async ({
    page,
  }) => {
    await page.goto("/my-clubs");
    await page.waitForURL("**/clubs?tab=my-clubs");

    expect(
      new URL(page.url()).pathname + new URL(page.url()).search,
      "two memberships must route to the club list with the my-clubs tab active"
    ).toBe("/clubs?tab=my-clubs");

    await expect(page.getByText("Seed Approved Club", { exact: false }).first()).toBeVisible();
  });

  test("opens the club dashboard and sees the club's own events", async ({ page }) => {
    await page.goto(`/my-clubs/${IDS.approvedClub}`);

    await expect(page.getByText("Seed Approved Club", { exact: false }).first()).toBeVisible();
    await expect(
      page.getByText("Seed Approved Event", { exact: false }).first(),
      "the dashboard must list the club's own events"
    ).toBeVisible();
  });
});

test.describe("a member of a different club", () => {
  test.use({ storageState: storageStateFor("cross_club_attacker") });

  test("does not see the approved club on their own surface", async ({ page }) => {
    // One membership, so this persona lands on its OWN club's dashboard.
    await page.goto("/my-clubs");
    await page.waitForURL(`**/my-clubs/${IDS.otherClub}`);

    await expect(
      page.locator("body"),
      "a club this user does not belong to must not appear on their own clubs surface"
    ).not.toContainText("Seed Approved Club");
  });
});

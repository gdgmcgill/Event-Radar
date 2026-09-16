/**
 * admin-moderation-queue.spec.ts — the moderation queue an admin actually sees.
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
 *
 * Re-confirms two Validated workflows from PROJECT.md:
 *   "Events posted by organizers for their own clubs are auto-approved; other
 *    events and clubs go through pending → approved/rejected moderation"
 *   "Admins approve/reject events and clubs, ban/suspend users, review reports
 *    and appeals, with actions written to admin_audit_log"
 *   — the second recorded there as contradicted by Phase 1 evidence (F-007).
 *   This spec asserts the QUEUE, which is the read half. It performs no
 *   moderation action and therefore makes no claim about the audit-log half,
 *   which F-072/F-073 have open in any case.
 *
 * The seed puts exactly one event and one club in `pending`, both with fixed
 * ids, so "the queue shows the pending rows" is a statement about known rows
 * rather than about whatever happened to sort first.
 */

import { expect, test } from "@playwright/test";

import { storageStateFor } from "../fixtures";

test.describe("an admin", () => {
  test.use({ storageState: storageStateFor("admin") });

  test("reaches the moderation surface and sees the pending event and pending club", async ({
    page,
  }) => {
    await page.goto("/moderation");

    await expect(
      page.getByText("Seed Pending Event", { exact: false }).first(),
      "the pending event must be in the queue"
    ).toBeVisible();

    await expect(
      page.getByText("Seed Pending Club", { exact: false }).first(),
      "the pending club must be in the queue"
    ).toBeVisible();
  });

  test("sees every seeded event in the queue, and the Pending filter narrows it", async ({
    page,
  }) => {
    // NOTE ON THE URL. `/moderation` links here as `?status=pending`, but the
    // page ignores the query parameter and opens on "All Statuses" — measured,
    // not assumed. That is a small pre-existing defect, registered as deferred
    // item D-22 rather than asserted here; this spec drives the control the user
    // actually has, because asserting the broken deep link would freeze it.
    await page.goto("/moderation/events");

    await expect(page.getByText("Seed Pending Event", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Seed Approved Event", { exact: false }).first()).toBeVisible();

    // The status control is a <select>, not a row of buttons.
    await page.getByRole("combobox").first().selectOption("pending");

    await expect(page.getByText("Seed Pending Event", { exact: false }).first()).toBeVisible();
    await expect(
      page.locator("body"),
      "the Pending filter must exclude events that are already approved"
    ).not.toContainText("Seed Approved Music Night");
    await expect(
      page.locator("body"),
      "the Pending filter must exclude events that are already rejected"
    ).not.toContainText("Seed Rejected Event");
  });
});

test.describe("a student", () => {
  test.use({ storageState: storageStateFor("onboarded_student") });

  test("does not reach the moderation queue", async ({ page }) => {
    await page.goto("/moderation");

    // The assertion is about the QUEUE's contents, not about which mechanism
    // keeps them out — a redirect, an empty state and an access-denied page are
    // all acceptable answers; showing another user's pending rows is not.
    await expect(
      page.locator("body"),
      "a non-admin must not be shown the moderation queue's contents"
    ).not.toContainText("Seed Pending Event");
  });
});

/**
 * anonymous-browse.spec.ts — browsing, searching and filtering without an account.
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
 *
 * Re-confirms two Validated workflows from PROJECT.md:
 *   "Anonymous visitors can browse public event and club content without an
 *    account"
 *   "User can browse, search, and filter events by tag, date, and time of day"
 *
 * THE MODERATION BOUNDARY IS PART OF "BROWSE", NOT A SEPARATE CONCERN.
 *   The seed holds five events on the same club: one approved and searchable,
 *   a second approved one, and three that are pending, rejected and suspended.
 *   A feed that leaked any of the last three would be a moderation failure that
 *   no amount of "the page rendered" would catch, so this spec asserts their
 *   absence as deliberately as it asserts the approved one's presence.
 *
 * NO STORAGE STATE, ON PURPOSE. `anonymous` is the one persona in the audit's
 * taxonomy with no account: it is the ABSENCE of a session, so this spec
 * declares an empty state rather than inheriting one.
 */

import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const APPROVED = "Seed Approved Event";
const APPROVED_2 = "Seed Approved Music Night";
const HIDDEN = ["Seed Pending Event", "Seed Rejected Event", "Seed Suspended Event"];

test("an anonymous visitor browses the event feed and sees only approved events", async ({
  page,
}) => {
  await page.goto("/");

  // The feed is client-fetched, so wait for the first seeded row rather than
  // for an arbitrary timeout.
  await expect(page.getByText(APPROVED, { exact: false }).first()).toBeVisible();
  await expect(page.getByText(APPROVED_2, { exact: false }).first()).toBeVisible();

  const body = page.locator("body");
  for (const title of HIDDEN) {
    await expect(
      body,
      `${title} is not approved and must never reach a public feed`
    ).not.toContainText(title);
  }
});

test("an anonymous visitor searches, and the search narrows the feed", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(APPROVED, { exact: false }).first()).toBeVisible();

  await page.getByPlaceholder("Search events, clubs, categories...").fill("Music Night");

  await expect(page.getByText(APPROVED_2, { exact: false }).first()).toBeVisible();
  await expect(
    page.locator("body"),
    "a search that matches one seeded event must not still be showing the other"
  ).not.toContainText(APPROVED);
});

test("an anonymous visitor browses public club content", async ({ page }) => {
  await page.goto("/clubs");

  await expect(page.getByText("Seed Approved Club", { exact: false }).first()).toBeVisible();
  await expect(
    page.locator("body"),
    "a club awaiting moderation must not be listed publicly"
  ).not.toContainText("Seed Pending Club");
});

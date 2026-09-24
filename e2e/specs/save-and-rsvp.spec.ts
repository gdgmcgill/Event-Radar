/**
 * save-and-rsvp.spec.ts — saving an event, and RSVPing to it.
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
 *
 * Re-confirms the Validated workflow from PROJECT.md:
 *   "User can save/unsave events and RSVP (going/interested/cancelled)"
 *
 * IT NAVIGATES BY THE SEED'S FIXED ID, not by searching for a title. A title
 * search could match a different row; `/events/5eed…e1` cannot.
 *
 * THE SAVE IS NOT PRE-SEEDED. `scripts/seed/personas.ts` deliberately creates no
 * `saved_events` row for this persona — one would make this spec green before it
 * clicked anything. The loader purges saved rows for every seeded persona, so
 * the save this spec makes cannot leak into the next run either.
 *
 * ASSERTIONS ARE ON THE END STATE, NOT ON THE CLICK'S DELTA, so a re-run against
 * an already-saved event still measures the thing that matters.
 *
 * AND THEY WAIT FOR THE WRITE, NOT FOR THE LABEL. `EventDetailView.handleSave`
 * flips `saved` OPTIMISTICALLY — `setSaved((prev) => !prev)` runs before the POST
 * does — so "the button now says Unsave" proves only that React re-rendered.
 * The first version of this spec asserted exactly that, navigated to the profile
 * while the request was still in flight, and failed. Both tests below wait on the
 * RESPONSE. Optimistic UI is a correct thing for the product to do and a trap for
 * a test that does not know about it.
 *
 * PHASE 4 ADDITIONS (plan 04-02, all PRESERVE — they assert current behaviour):
 *   1. The save test reloads the event page after the write lands and waits for
 *      GET /api/users/saved-events. After a reload `EventDetailClient` derives
 *      the saved state from THAT route, so the Unsave control is now proof the
 *      API path agrees — the profile assertion only ever exercised the RSC
 *      path (research Pitfall 1). The response's `savedEventIds` is checked too.
 *   2. The RSVP test asserts the going count after its existing reload. The
 *      count is only trustworthy after a reload: `RsvpButton` adjusts it with
 *      optimistic arithmetic on click (research Pitfall 2). It must read 2 — the
 *      seeded club_member going row plus this persona's — and, being an end
 *      state, still reads 2 on a re-run against an already-RSVP'd event.
 *   3. A new test on the second seeded event, whose only RSVP is club_member's
 *      CANCELLED row, asserts the going count reads 0: a cancelled RSVP is not
 *      counted. Plan 04-05 replaces how the counts are computed (F-079); these
 *      two count assertions are the end-to-end half of proving it unchanged.
 */

import { expect, test, type Page } from "@playwright/test";

import { IDS, storageStateFor } from "../fixtures";

test.use({ storageState: storageStateFor("onboarded_student") });

const EVENT_URL = `/events/${IDS.approvedEvent}`;

test("a student saves an event and it appears on their profile", async ({ page }) => {
  await page.goto(EVENT_URL);

  const save = page.getByRole("button", { name: "Save", exact: true });
  const unsave = page.getByRole("button", { name: "Unsave", exact: true });

  await expect(save.or(unsave).first()).toBeVisible();
  if (await save.isVisible().catch(() => false)) {
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/api/events/${IDS.approvedEvent}/save`) && r.request().method() === "POST"
      ),
      save.click(),
    ]);
  }

  // The control's own accessible name flips, AND the write has landed.
  await expect(unsave, "the save control must report the saved state").toBeVisible();

  // After a reload the saved state is no longer React state: EventDetailClient
  // re-derives it from GET /api/users/saved-events. Read that route directly
  // after the reload, check it carries this event, then check the control
  // agrees with it. (DI-38: intercepting the page's own GET raced the reload —
  // a pre-reload response could satisfy the predicate and lose its body.)
  await page.reload();
  const savedList = await page.request.get("/api/users/saved-events");
  expect(savedList.status(), "GET /api/users/saved-events must succeed").toBe(200);
  expect(
    ((await savedList.json()) as { savedEventIds: string[] }).savedEventIds,
    "the saved-events API must list the event just saved"
  ).toContain(IDS.approvedEvent);
  await expect(
    page.getByRole("button", { name: "Unsave", exact: true }),
    "after a reload the saved state comes from the API route, and it must still say saved"
  ).toBeVisible();

  await page.goto("/profile");
  await expect(
    page.getByText("Seed Approved Event", { exact: false }).first(),
    "a saved upcoming event must appear on the profile's saved list"
  ).toBeVisible();
});

test("a student RSVPs going to an event", async ({ page }) => {
  await page.goto(EVENT_URL);

  const going = page.getByRole("button", { name: "Going", exact: true });
  const cancel = page.getByRole("button", { name: "Cancel", exact: true });

  await expect(going.or(cancel).first()).toBeVisible();
  if (await going.isVisible().catch(() => false)) {
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/api/events/${IDS.approvedEvent}/rsvp`) && r.request().method() !== "GET"
      ),
      going.click(),
    ]);
  }

  // "Going" becomes "Cancel" once the RSVP is recorded — the control's label IS
  // the state, so asserting on it is asserting on what the user sees.
  await expect(cancel, "the RSVP control must report the going state").toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
    "the RSVP must survive a reload, which means it was written rather than held in state"
  ).toBeVisible();

  // After the reload the count is the server's, not optimistic arithmetic: the
  // seeded club_member going row plus this persona's.
  await expect(
    goingCount(page),
    "the going count after a reload must be the seeded going RSVP plus this persona's"
  ).toHaveText("2");
});

test("a cancelled RSVP is not counted as going", async ({ page }) => {
  // The second seeded event's only RSVP is club_member's CANCELLED row, and
  // this persona never RSVPs to it.
  const [counts] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes(`/api/events/${IDS.secondApprovedEvent}/rsvp`) && r.request().method() === "GET"
    ),
    page.goto(`/events/${IDS.secondApprovedEvent}`),
  ]);
  expect(counts.status(), "the RSVP counts request must succeed").toBe(200);

  await expect(
    goingCount(page),
    "a cancelled RSVP must not be counted as going"
  ).toHaveText("0");
});

/**
 * The going count as `RsvpButton` renders it: a `strong` number followed by the
 * word "going" inside one span. Anchored, so "3 friends going" cannot match.
 */
function goingCount(page: Page) {
  return page.locator("span", { hasText: /^\s*\d+\s+going\s*$/ }).locator("strong");
}

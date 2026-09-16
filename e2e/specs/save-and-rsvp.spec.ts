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
 */

import { expect, test } from "@playwright/test";

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
});

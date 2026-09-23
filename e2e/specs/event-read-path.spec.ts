/**
 * event-read-path.spec.ts — the Slice 2 read path, against the real PostgREST.
 *
 * Phase 04-slices-1-2-saved-events-rsvp-and-the-event-read-path · plan 04-04
 * (tests 6 and 7, F-082, flipped from DEFECT to FIXED by plan 04-08, under DEC-32)
 *
 * Re-confirms two Validated workflows from PROJECT.md:
 *   "Anonymous visitors can browse public event and club content without an
 *    account"
 *   "User can browse, search, and filter events by tag, date, and time of day"
 *
 * WHY THIS SPEC EXISTS NEXT TO THE JEST SUITES. Two of Slice 2's four defects
 * are properties of PostgREST's own grammar: a comma in the search term
 * breaks the `or=` logic tree (F-082), and `%` is a live ILIKE wildcard. The
 * in-memory fake behind the Jest suites can record the string the handler
 * builds, but it cannot parse it. So the API-level tests here go through
 * Playwright's `request` fixture to the running app, which calls the local
 * stack's real PostgREST. The two rendered consequences — what the detail
 * page's "Hosted by" line says (F-080) and which tag rows the feed files an
 * event under (F-081) — are measured in the browser, on the seed.
 *
 * Each title starts with its tag. PRESERVE tests hold before and after every
 * Slice 2 commit. A DEFECT test pins today's wrong behaviour under its F-nnn
 * and moves, deliberately, in the plan named beside it; once moved it is
 * retitled FIXED and asserts the corrected behaviour:
 *
 *   1. PRESERVE           GET /api/events?limit=1 → 200, first id is the approved event, total 2
 *   2. PRESERVE           GET /api/events?search=Music Night → exactly the second approved event
 *   3. PRESERVE           typing `a,b` into the search box shows "No events found" (today because
 *                         the page ignores the 500; after 04-08 because nothing matches)
 *   4. PRESERVE           /events/<approved id> renders "Seed Approved Event"
 *   5. DEFECT F-083       the limit=1 body has no `nextCursor` although total is 2  — moves in 04-09
 *   6. FIXED (F-082)      search=a,b → 200 with an empty events list. Before 04-08: a 500
 *                         echoing "failed to parse logic tree" (the F-059 echo)     — moved in 04-08
 *   7. FIXED (F-082)      search=% → total 0: a percent sign matches only a literal percent.
 *                         Before 04-08: total 2, every event                         — moved in 04-08
 *   8. DEFECT F-080       the detail page says "Hosted by" the organizer label, not the club
 *                         — moves only if the 04-11 decision ships the visual fix
 *   9. DEFECT F-081       the feed files "Seed Approved Event" (stored academic + tech) under a
 *                         Social row, and there is no Tech row at all
 *                         — moves only if the 04-11 decision ships the identity mappings
 *
 * Test 9 is about the ROWS, not a badge on the card. On `/` every card is a
 * `DiscoveryCard`, which renders the club name and no tag labels. The tags
 * surface as `CategoryRowsSection` headings, one row per mapped tag. The
 * filter chips also render every label, so the test scopes to section
 * headings, which the chips are not. (By code reading, not measured here: the
 * club page `/clubs/<id>` reads events directly and never calls `mapTags`, so
 * its `EventCard` labels the stored tags, Tech included. That page is not
 * this read path.)
 *
 * The organizer label is PRNG-picked by the seed (`scripts/seed/load.ts:325-349`),
 * so test 8 reads it from the API instead of hard-coding it.
 *
 * NO STORAGE STATE, ON PURPOSE: every test here is anonymous, and the read path
 * is public.
 */

import { expect, test } from "@playwright/test";

import { IDS } from "../fixtures";

test.use({ storageState: { cookies: [], origins: [] } });

const APPROVED = "Seed Approved Event";
const APPROVED_CLUB = "Seed Approved Club";

interface ListBody {
  events: Array<{ id: string; title: string }>;
  total: number;
  [key: string]: unknown;
}

// ─── PRESERVE ───────────────────────────────────────────────────────────────

test("PRESERVE: GET /api/events?limit=1 returns 200 with the approved event first and total 2", async ({
  request,
}) => {
  const res = await request.get("/api/events?limit=1");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as ListBody;
  expect(body.events).toHaveLength(1);
  expect(body.events[0].id).toBe(IDS.approvedEvent);
  expect(body.total).toBe(2);
});

test("PRESERVE: GET /api/events?search=Music Night returns exactly the second approved event", async ({
  request,
}) => {
  const res = await request.get("/api/events?search=Music%20Night");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as ListBody;
  expect(body.events.map((e) => e.id)).toEqual([IDS.secondApprovedEvent]);
});

test("PRESERVE: typing a,b into the search box shows the No events found state", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(APPROVED, { exact: false }).first()).toBeVisible();

  const searched = page.waitForResponse(
    (r) => r.url().includes("/api/events") && new URL(r.url()).searchParams.get("search") === "a,b"
  );
  await page.getByPlaceholder("Search events, clubs, categories...").fill("a,b");
  await searched;

  await expect(page.getByText("No events found", { exact: true })).toBeVisible();
});

test("PRESERVE: the approved event's detail page renders its title", async ({ page }) => {
  await page.goto(`/events/${IDS.approvedEvent}`);
  await expect(page.getByRole("heading", { name: APPROVED }).first()).toBeVisible();
});

// ─── DEFECT ─────────────────────────────────────────────────────────────────

test("DEFECT F-083: the list body has no nextCursor although more rows remain (moves in 04-09)", async ({
  request,
}) => {
  const res = await request.get("/api/events?limit=1");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as ListBody;
  expect(body.total).toBeGreaterThan(body.events.length);
  expect(body).not.toHaveProperty("nextCursor");
});

test("DEFECT F-080: the detail page says Hosted by the organizer label, not the event's real club (moves only if 04-11 ships the visual fix)", async ({
  page,
  request,
}) => {
  const res = await request.get(`/api/events/${IDS.approvedEvent}`);
  expect(res.status()).toBe(200);
  const { event } = (await res.json()) as {
    event: { organizer: string; club_id: string; club: { id: string; name: string } };
  };
  expect(event.organizer).toMatch(/^Seed Organizer [ABC]$/);
  expect(event.club_id).toBe(IDS.approvedClub);
  expect(event.club.id).toBe(event.organizer);

  await page.goto(`/events/${IDS.approvedEvent}`);
  const hostedBy = page.getByText("Hosted by", { exact: true });
  await expect(hostedBy).toBeVisible();
  const hostName = hostedBy.locator("xpath=following-sibling::p[1]");
  await expect(hostName).toHaveText(event.organizer);
  await expect(hostName).not.toHaveText(APPROVED_CLUB);
});

test("DEFECT F-081: the feed files the academic+tech event under a Social row, and there is no Tech row (moves only if 04-11 ships the identity mappings)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(APPROVED, { exact: false }).first()).toBeVisible();

  // A row heading's accessible name carries its count: "Social 2 events".
  const rowHeading = (label: string) =>
    page.getByRole("heading", { name: new RegExp(`^${label} \\d+ events?$`) });
  const row = (label: string) => page.locator("section").filter({ has: rowHeading(label) });

  await expect(row("Social")).toHaveCount(1);
  await expect(row("Social").getByRole("heading", { name: APPROVED, exact: true })).toBeVisible();
  await expect(row("Academic").getByRole("heading", { name: APPROVED, exact: true })).toBeVisible();
  // Asserted only after the rows above have rendered, so a count of 0 is a
  // measurement and not a page that has not loaded yet.
  await expect(rowHeading("Tech")).toHaveCount(0);
});

// ─── FIXED ──────────────────────────────────────────────────────────────────

// Moved in 04-08 (DEC-32). Before: 500 whose error contained "failed to parse
// logic tree" — the F-059 echo. The comma is now inside a quoted value.
test("FIXED F-082: search=a,b is a 200 with an empty events list (moved in 04-08)", async ({
  request,
}) => {
  const res = await request.get("/api/events?search=a,b");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as ListBody;
  expect(body.events).toEqual([]);
  expect(body.total).toBe(0);
});

// Moved in 04-08 (DEC-32). Before: total 2, both approved events. `%` is now
// LIKE-literal, and no seeded title or description contains one.
test("FIXED F-082: search=% matches only a literal percent, so no seeded event (moved in 04-08)", async ({
  request,
}) => {
  const res = await request.get("/api/events?search=%25");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as ListBody;
  expect(body.total).toBe(0);
  expect(body.events).toEqual([]);
});

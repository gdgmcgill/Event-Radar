/**
 * ban-and-onboarding-ring.spec.ts — the slice-3 auth ring, through a real
 * browser, a production build and the seeded local database.
 *
 * Phase 05-slices-3-5-auth-club-authorization-admin-containment · plan 05-08
 *
 * WHAT MOVED IN SLICE 3, AND WHAT THIS FILE PROVES OF IT
 *   - F-062 / DEC-36: a banned caller on `/api/*` gets a JSON 403
 *     `{"error":"Account suspended"}` instead of an HTML redirect to `/banned`.
 *     Pages still land on `/banned`.
 *   - F-088 / DEC-34: every write arm refuses a banned caller itself, and the
 *     proxy answers first on `/api/*`, so the status is the same whichever ring
 *     answers. `suspension_expired` (banned_at set, expiry past) must still
 *     pass: an implementation that read only `banned_at` would fail it.
 *   - F-089 / DEC-34 / DEC-36: onboarding is database truth. Deleting the
 *     `needs_onboarding` cookie no longer frees an un-onboarded account on
 *     pages, and a direct API write gets 403 `{"error":"Onboarding required"}`
 *     from the handler ring. The two calls the wizard makes
 *     (`PATCH /api/users/[id]` and `POST /api/onboarding/complete`) are the
 *     DEC-34 exemptions and must still succeed.
 *   - DEC-35 (no profile row) lives in `no-profile-row.spec.ts`, because the
 *     seed cannot express that persona (DEC-54).
 *
 * ASSERTS STATUS, CONTENT TYPE, BODY AND FINAL PATHNAME, NEVER RENDERED MARKUP.
 *   Same discipline as `banned-redirect.spec.ts`: what is under test is the
 *   ring, not the page it lands on.
 *
 * NO SEED ROW IS LEFT CHANGED.
 *   The refused writes change nothing by construction. The wizard PATCH sends
 *   the persona's own seeded name back, so the only column that moves is
 *   `updated_at`. `POST /api/onboarding/complete` clears a cookie and writes no
 *   row. `onboarding_completed` stays false.
 */

import { expect, test, type APIResponse } from "@playwright/test";

import { PERSONAS } from "../../scripts/seed/personas";
import { BANNED_PATH, IDS, storageStateFor } from "../fixtures";

const SAVE_PATH = `/api/events/${IDS.approvedEvent}/save`;
const SAVED_EVENTS_PATH = "/api/users/saved-events";

const MID_ONBOARDING_NAME = PERSONAS.find(
  (p) => p.key === "mid_onboarding_student"
)!.name;

/** A 403 carrying exactly `{ error }` as JSON, which is F-062's whole point. */
async function expectJson403(res: APIResponse, error: string): Promise<void> {
  expect(res.status(), `expected a 403 carrying ${JSON.stringify(error)}`).toBe(403);
  expect(res.headers()["content-type"] ?? "").toContain("application/json");
  expect(await res.json()).toEqual({ error });
}

test.describe("a permanently banned user (F-062, F-088)", () => {
  test.use({ storageState: storageStateFor("banned_permanent") });

  test("gets a JSON 403 Account suspended on an API write", async ({ page }) => {
    await expectJson403(await page.request.post(SAVE_PATH), "Account suspended");
  });

  test("gets the same JSON 403 on an API read", async ({ page }) => {
    await expectJson403(await page.request.get(SAVED_EVENTS_PATH), "Account suspended");
  });

  test("is still sent to the ban page on a page request", async ({ page }) => {
    await page.goto("/my-events");
    expect(new URL(page.url()).pathname).toBe(BANNED_PATH);
  });
});

test.describe("a user whose suspension is still running (F-088)", () => {
  test.use({ storageState: storageStateFor("suspended_active") });

  test("gets a JSON 403 Account suspended on an API write", async ({ page }) => {
    await expectJson403(await page.request.post(SAVE_PATH), "Account suspended");
  });
});

test.describe("a user whose suspension has expired", () => {
  test.use({ storageState: storageStateFor("suspension_expired") });

  test("reads their own saved events, because banned_at alone is not a ban", async ({ page }) => {
    const res = await page.request.get(SAVED_EVENTS_PATH);
    expect(res.status()).toBe(200);
  });
});

test.describe("the mid-onboarding student (F-089, DEC-34)", () => {
  test.use({ storageState: storageStateFor("mid_onboarding_student") });

  test("is sent to onboarding from the home page", async ({ page }) => {
    await page.goto("/");
    expect(new URL(page.url()).pathname).toBe("/onboarding");
  });

  test("is still sent to onboarding with the needs_onboarding cookie deleted (database truth)", async ({ page }) => {
    await page.context().clearCookies({ name: "needs_onboarding" });
    const left = await page.context().cookies();
    expect(left.some((c) => c.name === "needs_onboarding")).toBe(false);

    await page.goto("/my-events");
    expect(new URL(page.url()).pathname).toBe("/onboarding");
  });

  test("gets a JSON 403 Onboarding required on a direct API write", async ({ page }) => {
    await expectJson403(await page.request.post(SAVE_PATH), "Onboarding required");
  });

  test("can still make the wizard's self-update (exempt from the onboarding guard)", async ({ page }) => {
    const res = await page.request.patch(`/api/users/${IDS.mid_onboarding_student}`, {
      data: { name: MID_ONBOARDING_NAME },
    });
    expect(res.status()).toBe(200);
  });

  test("can still complete onboarding (exempt from the onboarding guard)", async ({ page }) => {
    const res = await page.request.post("/api/onboarding/complete");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
});

/**
 * csrf-origin.spec.ts — what a state-changing API route does with a request
 * that says it came from another site, through a real session, a production
 * build and the seeded local database.
 *
 * Phase 05-slices-3-5-auth-club-authorization-admin-containment · plan 05-12
 *
 * WHAT IS PINNED, AND WHERE IT MOVES
 *   - DEFECT F-090: no route and no proxy branch reads `Origin` or
 *     `Sec-Fetch-Site`, so a signed-in POST carrying `Origin:
 *     https://evil.example`, or `Sec-Fetch-Site: cross-site`, is accepted and
 *     the event is saved. The only barrier today is the `SameSite=Lax` default
 *     on the session cookie. 05-17 adds the proxy's origin check (DEC-52) and
 *     flips both tests to 403 `{"error":"Cross-site request blocked"}` with no
 *     row written.
 *   - PRESERVE: a same-origin POST (`Origin: http://127.0.0.1:3000`, the
 *     harness's own origin) and a POST carrying neither header (curl, cron,
 *     server-to-server) are accepted. DEC-52 keeps both.
 *
 * The persona is `onboarded_student` and the target is `IDS.secondApprovedEvent`,
 * which no other spec saves. `POST /api/events/[id]/save` TOGGLES, so every
 * test first clears any saved row with a plain DELETE (no Origin header), then
 * POSTs, and a `finally` block DELETEs again whatever the assertions did. The
 * run is followed by a database check that `saved_events` holds no row for
 * this persona and event (T-05-12-02), recorded in
 * `evidence/slice-5-characterization.txt`.
 */

import { expect, test, type APIRequestContext } from "@playwright/test";

import { IDS, storageStateFor } from "../fixtures";

const SAVE = `/api/events/${IDS.secondApprovedEvent}/save`;
const SAVED_EVENTS = "/api/users/saved-events";

/** Plain DELETE, no Origin header: the restore path, and a precondition. */
async function unsave(request: APIRequestContext): Promise<void> {
  const res = await request.delete(SAVE);
  expect(res.status(), "the restoring DELETE must succeed").toBe(200);
  expect(await res.json()).toEqual({ saved: false });
}

async function isSaved(request: APIRequestContext): Promise<boolean> {
  const res = await request.get(SAVED_EVENTS);
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { savedEventIds: string[] };
  return body.savedEventIds.includes(IDS.secondApprovedEvent);
}

async function postAndExpectSaved(
  request: APIRequestContext,
  headers: Record<string, string>
): Promise<void> {
  await unsave(request);
  try {
    const res = await request.post(SAVE, { headers });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ saved: true });
    expect(await isSaved(request), "the event must now be saved").toBe(true);
  } finally {
    await unsave(request);
  }
  expect(await isSaved(request), "the restore must leave no saved row").toBe(false);
}

test.describe("an onboarded student's session, from another site", () => {
  test.use({ storageState: storageStateFor("onboarded_student") });

  test("DEFECT F-090: a POST carrying Origin https://evil.example is accepted", async ({
    page,
  }) => {
    await postAndExpectSaved(page.request, { Origin: "https://evil.example" });
  });

  test("DEFECT F-090: a POST carrying Sec-Fetch-Site cross-site is accepted", async ({
    page,
  }) => {
    await postAndExpectSaved(page.request, { "Sec-Fetch-Site": "cross-site" });
  });
});

test.describe("an onboarded student's session, same site or no browser", () => {
  test.use({ storageState: storageStateFor("onboarded_student") });

  test("PRESERVE: a POST with the application's own Origin is accepted", async ({
    page,
    baseURL,
  }) => {
    expect(baseURL).toBe("http://127.0.0.1:3000");
    await postAndExpectSaved(page.request, { Origin: "http://127.0.0.1:3000" });
  });

  test("PRESERVE: a POST with neither Origin nor Sec-Fetch-Site is accepted", async ({
    page,
  }) => {
    await postAndExpectSaved(page.request, {});
  });
});

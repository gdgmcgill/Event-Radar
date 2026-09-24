/**
 * club-invitation-acceptance.spec.ts — F-016 end to end: A invites B, B opens
 * the invitation and accepts it, B is a member.
 *
 * Phase 05-slices-3-5-auth-club-authorization-admin-containment · plan 05-11
 * (DEC-43)
 *
 * WHAT THIS PROVES, AND WHERE
 *   Production has not applied the invitee policies
 *   (`supabase/migrations/20260916000000_invitation_policy_fixes.sql`), so this
 *   is a LOCAL proof. F-016 stays Open with `closes_in_phase: "08"` until the
 *   DI-23 migration repair applies them (DEC-43, DEC-57). What runs here is the
 *   product path and nothing else:
 *     1. club_owner      POST /api/clubs/<approvedClub>/invites  → 201 + token
 *     2. onboarded_student opens /invites/<token>, which is a server component
 *        that reads the invitation, checks the email and auto-accepts
 *        (membership INSERT + invitation UPDATE, both on the student's own
 *        cookie client, both under RLS)
 *     3. club_owner      GET invites → that row is `accepted`
 *     4. club_owner      GET members → onboarded_student is an organizer
 *
 * THE SEED IS RESTORED (T-05-11-05)
 *   The accept writes a membership. `afterAll` removes it through the product's
 *   own DELETE /api/clubs/<id>/members as club_owner and re-reads the list to
 *   prove it is gone. A `beforeAll` pre-check removes a leftover membership
 *   the same way, so a re-run after a failed run starts clean. The accepted
 *   invitation row remains: the POST refuses only PENDING duplicates, so it
 *   does not block a re-run, and no other spec reads invitations.
 *
 * Two personas act in one serial flow, so each gets its own browser context
 * with its own storage state, rather than a file-level `test.use`.
 */

import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
} from "@playwright/test";

import { BASE_URL } from "../../playwright.config";
import { IDS, PERSONA_CREDENTIALS, storageStateFor } from "../fixtures";

const CLUB = `/api/clubs/${IDS.approvedClub}`;
const INVITEE_EMAIL = PERSONA_CREDENTIALS.onboarded_student.email.toLowerCase();

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  user: { id: string; email: string } | null;
}

interface InviteRow {
  id: string;
  invitee_email: string;
  status: string;
  created_at: string;
}

async function membersOf(owner: APIRequestContext): Promise<MemberRow[]> {
  const res = await owner.get(`${CLUB}/members`);
  expect(res.status(), "the owner can list the club's members").toBe(200);
  const body = (await res.json()) as { members: MemberRow[] };
  return body.members;
}

/**
 * Remove onboarded_student from the approved club through the product API, if
 * present, and prove the list no longer holds them.
 */
async function removeInviteeMembership(owner: APIRequestContext): Promise<void> {
  const row = (await membersOf(owner)).find(
    (m) => m.user_id === IDS.onboarded_student
  );
  if (row) {
    const res = await owner.delete(`${CLUB}/members`, {
      data: { memberId: row.id },
    });
    expect(res.status(), "the owner removes the invitee's membership").toBe(200);
    expect(await res.json()).toEqual({ success: true });
  }
  const after = await membersOf(owner);
  expect(after.map((m) => m.user_id)).not.toContain(IDS.onboarded_student);
}

async function contextFor(
  browser: Browser,
  persona: "club_owner" | "onboarded_student"
): Promise<BrowserContext> {
  // A context made here does not inherit the project's `use` block, so the
  // origin and the CSP bypass (see playwright.config.ts) are passed explicitly,
  // as e2e/auth.setup.ts does.
  return browser.newContext({
    baseURL: BASE_URL,
    bypassCSP: true,
    storageState: storageStateFor(persona),
  });
}

test.describe.serial("club invitation acceptance (F-016, DEC-43)", () => {
  let ownerContext: BrowserContext;
  let token: string;

  test.beforeAll(async ({ browser }) => {
    ownerContext = await contextFor(browser, "club_owner");
    // Pre-check: a failed earlier run may have left the membership behind.
    await removeInviteeMembership(ownerContext.request);
  });

  test.afterAll(async () => {
    // Runs on success and on failure: the seed's membership set is restored.
    await removeInviteeMembership(ownerContext.request);
    await ownerContext.close();
  });

  test("the club owner invites the student by email", async () => {
    const res = await ownerContext.request.post(`${CLUB}/invites`, {
      data: { email: INVITEE_EMAIL },
    });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as { invite: { token: string } };
    expect(body.invite.token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    token = body.invite.token;
  });

  test("the student opens the invitation and it is accepted", async ({
    browser,
  }) => {
    const studentContext = await contextFor(browser, "onboarded_student");
    try {
      const page = await studentContext.newPage();
      const res = await page.goto(`/invites/${token}`);
      expect(res?.status()).toBe(200);

      // Not an error card: the two failures F-016 produced (the invitation
      // invisible to its recipient, the membership insert refused) render
      // these titles.
      await expect(
        page.getByRole("heading", { name: "Wrong Account" })
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Something Went Wrong" })
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Invalid Invitation" })
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: /^Welcome to / })
      ).toBeVisible();
    } finally {
      await studentContext.close();
    }
  });

  test("the owner sees the invitation accepted", async () => {
    const res = await ownerContext.request.get(`${CLUB}/invites`);
    expect(res.status()).toBe(200);
    const invites = (await res.json()) as InviteRow[];
    // Newest first (the route orders by created_at descending), so the first
    // row for this email is the one this run created.
    const ours = invites.find((i) => i.invitee_email === INVITEE_EMAIL);
    expect(ours, "the invitation is listed for the owner").toBeDefined();
    expect(ours?.status).toBe("accepted");
    expect(
      invites.filter(
        (i) => i.invitee_email === INVITEE_EMAIL && i.status === "pending"
      ),
      "no pending invitation for the student remains"
    ).toHaveLength(0);
  });

  test("the student is now a member of the club, as an organizer", async () => {
    const row = (await membersOf(ownerContext.request)).find(
      (m) => m.user_id === IDS.onboarded_student
    );
    expect(row, "the student's membership is listed").toBeDefined();
    expect(row?.role).toBe("organizer");
    // Not asserted: `row.user`. The route enriches members from `users` on the
    // owner's cookie client, and `users` SELECT is own-row or admin only, so
    // every member but the caller comes back with `user: null` (measured on the
    // first run of this spec; registered as DI-49 part 2).
  });
});

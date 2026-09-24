/**
 * club-authorization.spec.ts — the club authz ring through a real browser
 * session, a production build and the seeded local database.
 *
 * Phase 05-slices-3-5-auth-club-authorization-admin-containment · plan 05-09
 *
 * WHAT THIS FILE PINS, BEFORE SLICE 4 CHANGES ANYTHING
 *   - REFAC-12 / DEC-40: every club-membership decision collapses into
 *     `requireClubRole` in 05-10, and each site keeps its own 403 bytes. This
 *     file pins those bytes as the seeded personas actually receive them: the
 *     cross-club attacker on every club mutation and member-only read of the
 *     approved club, and the club's organizer on an owner-only route.
 *   - The allowed half: the owner reads invitations, members and analytics;
 *     the organizer reads members and analytics.
 *   - F-087 / DEC-41: the owner's own `PATCH /api/clubs/<id>` answered 500
 *     through 05-09, because the write ran on the cookie client and `clubs`
 *     has no owner UPDATE policy. 05-10 moved the write to the elevated door
 *     behind the owner gate and the handler's column whitelist. The test
 *     titled "FIXED F-087" pins the 200, and pins that a `status` smuggled
 *     into the body is still not written (the whitelist is the control that
 *     replaces RLS on this path, T-05-10-03).
 *
 * EVERY 403 BODY WAS MEASURED ON THE FIRST RUN AND COMPARED WITH RESEARCH § C.
 *   The strings below are § C's "Deny bytes (keep)" column. The first run's
 *   output is in `evidence/slice-4-characterization.txt` §3. A mismatch would
 *   have been recorded there, not edited away here.
 *
 * NO SEEDED VALUE CAN CHANGE.
 *   - Every body the attacker sends would fail validation even if its gate
 *     were open: an empty PATCH, a wrong confirmation name, no email, no new
 *     owner, the owner's own membership as the removal or role target, and a
 *     text file where an image is required. So a gate that regressed would
 *     turn this file red without writing a row.
 *   - The organizer's owner-only PATCH is an empty body, for the same reason.
 *   - The owner's PATCHes send the club's CURRENT description, read first, so
 *     the write that now succeeds rewrites the same value; the smuggled
 *     `status: "rejected"` is dropped by the whitelist, which the follow-up
 *     read proves.
 *   The remaining calls are reads.
 */

import { expect, test, type APIResponse } from "@playwright/test";

import { IDS, storageStateFor } from "../fixtures";

const CLUB = `/api/clubs/${IDS.approvedClub}`;
const EVENT_ANALYTICS = `/api/events/${IDS.approvedEvent}/analytics`;

/** A 403 carrying exactly `{ error }` as JSON. */
async function expectJson403(res: APIResponse, error: string): Promise<void> {
  expect(res.status(), `expected a 403 carrying ${JSON.stringify(error)}`).toBe(403);
  expect(res.headers()["content-type"] ?? "").toContain("application/json");
  expect(await res.json()).toEqual({ error });
}

/** A text file where the upload routes require an image: a 400 if the gate were open. */
function notAnImage(clubId: string) {
  return {
    multipart: {
      file: {
        name: "not-an-image.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("not an image"),
      },
      clubId,
    },
  };
}

test.describe("the cross-club attacker on the approved club (REFAC-12)", () => {
  test.use({ storageState: storageStateFor("cross_club_attacker") });

  test("cannot update the club", async ({ page }) => {
    await expectJson403(
      await page.request.patch(CLUB, { data: {} }),
      "Only the club owner can update club details"
    );
  });

  test("cannot delete the club", async ({ page }) => {
    await expectJson403(
      await page.request.delete(CLUB, { data: { confirmName: "x" } }),
      "Only the club owner can delete the club"
    );
  });

  test("cannot view invitations", async ({ page }) => {
    await expectJson403(
      await page.request.get(`${CLUB}/invites`),
      "Only the club owner can view invitations"
    );
  });

  test("cannot send invitations", async ({ page }) => {
    await expectJson403(
      await page.request.post(`${CLUB}/invites`, { data: {} }),
      "Only the club owner can send invitations"
    );
  });

  test("cannot view members", async ({ page }) => {
    await expectJson403(
      await page.request.get(`${CLUB}/members`),
      "You must be a member of this club to view members"
    );
  });

  test("cannot remove members", async ({ page }) => {
    await expectJson403(
      await page.request.delete(`${CLUB}/members`, {
        data: { memberId: IDS.ownerOfApproved },
      }),
      "Only the club owner can remove members"
    );
  });

  test("cannot change member roles", async ({ page }) => {
    await expectJson403(
      await page.request.patch(`${CLUB}/members/role`, {
        data: { memberId: IDS.ownerOfApproved, role: "organizer" },
      }),
      "Only the club owner can change roles"
    );
  });

  test("cannot transfer ownership", async ({ page }) => {
    await expectJson403(
      await page.request.post(`${CLUB}/transfer`, { data: {} }),
      "Only the club owner can transfer ownership"
    );
  });

  test("cannot view club analytics", async ({ page }) => {
    await expectJson403(
      await page.request.get(`${CLUB}/analytics`),
      "You must be a club member to view analytics"
    );
  });

  test("cannot view the analytics of the club's event", async ({ page }) => {
    await expectJson403(
      await page.request.get(EVENT_ANALYTICS),
      "You must be a club member to view analytics"
    );
  });

  test("cannot upload the club's banner", async ({ page }) => {
    await expectJson403(
      await page.request.post("/api/clubs/banner", notAnImage(IDS.approvedClub)),
      "Only the club owner can upload a banner"
    );
  });

  test("cannot upload the club's logo", async ({ page }) => {
    await expectJson403(
      await page.request.post("/api/clubs/logo", notAnImage(IDS.approvedClub)),
      "Only the club owner can upload a logo"
    );
  });
});

test.describe("the club's organizer (not the owner)", () => {
  test.use({ storageState: storageStateFor("club_member") });

  test("cannot update the club (owner only)", async ({ page }) => {
    await expectJson403(
      await page.request.patch(CLUB, { data: {} }),
      "Only the club owner can update club details"
    );
  });

  test("can view members", async ({ page }) => {
    const res = await page.request.get(`${CLUB}/members`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { members: { user_id: string }[] };
    expect(body.members.map((m) => m.user_id)).toContain(IDS.club_member);
  });

  test("can view club analytics", async ({ page }) => {
    expect((await page.request.get(`${CLUB}/analytics`)).status()).toBe(200);
  });
});

test.describe("the club owner", () => {
  test.use({ storageState: storageStateFor("club_owner") });

  test("can view invitations", async ({ page }) => {
    const res = await page.request.get(`${CLUB}/invites`);
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("can view members", async ({ page }) => {
    const res = await page.request.get(`${CLUB}/members`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { members: { user_id: string }[] };
    expect(body.members.map((m) => m.user_id)).toEqual(
      expect.arrayContaining([IDS.club_owner, IDS.club_member])
    );
  });

  test("can view club analytics", async ({ page }) => {
    expect((await page.request.get(`${CLUB}/analytics`)).status()).toBe(200);
  });

  test("FIXED F-087: the owner's own club PATCH answers 200, and status stays unwritable", async ({ page }) => {
    type ClubBody = { club: { description: string; status: string } };

    const current = await page.request.get(CLUB);
    expect(current.status()).toBe(200);
    const { club } = (await current.json()) as ClubBody;
    expect(typeof club.description).toBe("string");
    expect(club.status).toBe("approved");

    // The same value back: the write succeeds and nothing changes.
    const res = await page.request.patch(CLUB, {
      data: { description: club.description },
    });
    expect(res.status()).toBe(200);
    expect(((await res.json()) as ClubBody).club.description).toBe(
      club.description
    );

    // A status smuggled beside a whitelisted field: the whitelisted field is
    // written, the status is not (self-approval stays impossible).
    const smuggled = await page.request.patch(CLUB, {
      data: { description: club.description, status: "rejected" },
    });
    expect(smuggled.status()).toBe(200);

    const after = (await (await page.request.get(CLUB)).json()) as ClubBody;
    expect(after.club.status).toBe("approved");
    expect(after.club.description).toBe(club.description);
  });
});

/**
 * admin-write-paths.spec.ts — the admin writes still work after their
 * operations were split between the cookie client and the elevated door.
 *
 * Phase 05-slices-3-5-auth-club-authorization-admin-containment · plan 05-15
 *
 * WHAT IS UNDER TEST (REFAC-13, DEC-49)
 *   Plan 05-15 moved every admin operation an existing RLS policy permits onto
 *   the admin's own cookie client (clubs, moderation_reviews, club_members,
 *   organizer_requests, event_reports, events), and left only what no policy
 *   can express on `getElevatedClient()`: notifications for another user,
 *   another user's roles, and the ban columns. The Jest routing suite proves
 *   which client each operation reaches. This spec proves that the split is
 *   correct against the REAL policies: a cell that research marked "permitted"
 *   but that RLS actually refuses would show up here as a 0-row write or a
 *   missing row, not as a green unit test.
 *
 *   Flows, as the seeded admin:
 *     1. approve a pending club → the club is approved, its creator is the
 *        owner, the creator gains club_organizer, a notification exists;
 *     2. resolve a report the creator filed → its status and reviewer change;
 *     3. approve an organizer request → approved, an organizer membership and
 *        a notification exist;
 *     4. ban the creator with suspend_content → banned, their approved club is
 *        suspended with a suspension review, a notification exists;
 *     5. unban → banned_at and ban_expires_at are cleared.
 *
 * WHY THE FIXTURE IS CREATED HERE (DEC-54)
 *   The seed is not changed in Phase 5, and these flows change the rows they
 *   touch. `beforeAll` creates a temporary auth user
 *   (`p5-fixture-organizer@mail.mcgill.ca`) with its public.users row, a
 *   pending club it created, a second approved fixture club (the organizer
 *   request's target, so no seeded club gains a member), a report it filed
 *   against `IDS.approvedEvent`, and its organizer request. Everything is
 *   written with the LOCAL service key from `localStackEnv()`, which
 *   playwright.config.ts has already passed through `assertSeedTargetAllowed`.
 *   `afterAll` removes every fixture row and the auth user and proves they are
 *   gone. The only seeded row read is `IDS.approvedEvent`, as a report target;
 *   no seeded row is written.
 *
 * NOTHING SECRET IS PRINTED. The service key and the random password never
 * appear in a log line or an assertion message.
 */

import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { localStackEnv } from "../env";
import { IDS, storageStateFor } from "../fixtures";

const FIXTURE_EMAIL = "p5-fixture-organizer@mail.mcgill.ca";
const FIXTURE_PREFIX = "p5-write-paths-fixture";

test.describe.serial("admin writes through their split clients (DEC-49)", () => {
  test.use({ storageState: storageStateFor("admin") });

  let service: SupabaseClient;
  let userId = "";
  const pendingClubId = randomUUID();
  const approvedClubId = randomUUID();
  let reportId = "";
  let requestId = "";

  async function authIdsForFixture(): Promise<string[]> {
    const { data, error } = await service.auth.admin.listUsers({ perPage: 1000 });
    expect(error).toBeNull();
    return data.users.filter((u) => u.email === FIXTURE_EMAIL).map((u) => u.id);
  }

  async function fixtureClubIds(): Promise<string[]> {
    const { data, error } = await service
      .from("clubs")
      .select("id")
      .like("name", `${FIXTURE_PREFIX}%`);
    expect(error).toBeNull();
    return (data ?? []).map((row: { id: string }) => row.id);
  }

  /** Removes every row a run of this spec can leave behind, for the given user ids. */
  async function removeFixtures(userIds: string[]): Promise<void> {
    const clubIds = await fixtureClubIds();
    const ok = (label: string, result: { error: unknown }) =>
      expect(result.error, label).toBeNull();

    if (userIds.length > 0) {
      const reports = await service
        .from("event_reports")
        .select("id")
        .in("reporter_id", userIds);
      ok("read reports", reports);
      const requests = await service
        .from("organizer_requests")
        .select("id")
        .in("user_id", userIds);
      ok("read requests", requests);
      const targets = [
        ...userIds,
        ...clubIds,
        ...(reports.data ?? []).map((r: { id: string }) => r.id),
        ...(requests.data ?? []).map((r: { id: string }) => r.id),
      ];
      ok("audit", await service.from("admin_audit_log").delete().in("target_id", targets));
      ok("notifications", await service.from("notifications").delete().in("user_id", userIds));
      ok("memberships", await service.from("club_members").delete().in("user_id", userIds));
      ok("requests", await service.from("organizer_requests").delete().in("user_id", userIds));
      ok("reports", await service.from("event_reports").delete().in("reporter_id", userIds));
    }
    if (clubIds.length > 0) {
      ok("club audit", await service.from("admin_audit_log").delete().in("target_id", clubIds));
      ok("reviews", await service.from("moderation_reviews").delete().in("target_id", clubIds));
      ok("club memberships", await service.from("club_members").delete().in("club_id", clubIds));
      ok("clubs", await service.from("clubs").delete().in("id", clubIds));
    }
    if (userIds.length > 0) {
      ok("users", await service.from("users").delete().in("id", userIds));
      for (const id of userIds) {
        const { error } = await service.auth.admin.deleteUser(id);
        expect(error).toBeNull();
      }
    }
  }

  test.beforeAll(async () => {
    const stack = localStackEnv();
    service = createClient(stack.url, stack.serviceRoleKey, {
      auth: { persistSession: false },
    });

    await removeFixtures(await authIdsForFixture());

    const created = await service.auth.admin.createUser({
      email: FIXTURE_EMAIL,
      password: randomUUID(),
      email_confirm: true,
    });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;

    const profile = await service.from("users").insert({
      id: userId,
      email: FIXTURE_EMAIL,
      name: "P5 Fixture Organizer",
      roles: ["user"],
      onboarding_completed: true,
      visibility: "public",
    });
    expect(profile.error).toBeNull();

    const clubs = await service.from("clubs").insert([
      {
        id: pendingClubId,
        name: `${FIXTURE_PREFIX} pending ${pendingClubId.slice(0, 8)}`,
        description: "Temporary fixture for admin-write-paths.spec.ts.",
        category: "Academic",
        status: "pending",
        created_by: userId,
      },
      {
        id: approvedClubId,
        name: `${FIXTURE_PREFIX} target ${approvedClubId.slice(0, 8)}`,
        description: "Temporary organizer-request target for admin-write-paths.spec.ts.",
        category: "Academic",
        status: "approved",
        created_by: null,
      },
    ]);
    expect(clubs.error).toBeNull();

    const report = await service
      .from("event_reports")
      .insert({
        event_id: IDS.approvedEvent,
        reporter_id: userId,
        category: "spam",
        message: "Temporary fixture report.",
      })
      .select("id")
      .single();
    expect(report.error).toBeNull();
    reportId = report.data!.id;

    const request = await service
      .from("organizer_requests")
      .insert({ user_id: userId, club_id: approvedClubId, message: "Fixture request." })
      .select("id")
      .single();
    expect(request.error).toBeNull();
    requestId = request.data!.id;
  });

  test.afterAll(async () => {
    await removeFixtures(userId ? [userId] : []);

    // Proof of cleanup: nothing this spec created is left.
    expect(await authIdsForFixture()).toHaveLength(0);
    expect(await fixtureClubIds()).toHaveLength(0);
    for (const [table, column] of [
      ["users", "id"],
      ["notifications", "user_id"],
      ["club_members", "user_id"],
      ["organizer_requests", "user_id"],
      ["event_reports", "reporter_id"],
    ] as const) {
      const left = await service.from(table).select("id").eq(column, userId);
      expect(left.error).toBeNull();
      expect(left.data ?? [], `${table} residue`).toHaveLength(0);
    }
    const reviews = await service
      .from("moderation_reviews")
      .select("id")
      .in("target_id", [pendingClubId, approvedClubId]);
    expect(reviews.data ?? []).toHaveLength(0);
    const audit = await service
      .from("admin_audit_log")
      .select("id")
      .in("target_id", [userId, pendingClubId, approvedClubId, reportId, requestId]);
    expect(audit.data ?? []).toHaveLength(0);
  });

  test("approving a pending club: approved, owner membership, organizer role, notification", async ({
    page,
  }) => {
    const res = await page.request.patch(`/api/admin/clubs/${pendingClubId}`, {
      data: { status: "approved" },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    const club = await service.from("clubs").select("status").eq("id", pendingClubId).single();
    expect(club.data?.status).toBe("approved");

    const membership = await service
      .from("club_members")
      .select("role")
      .eq("club_id", pendingClubId)
      .eq("user_id", userId);
    expect(membership.data).toEqual([{ role: "owner" }]);

    const user = await service.from("users").select("roles").eq("id", userId).single();
    expect(user.data?.roles).toContain("club_organizer");

    const notes = await service
      .from("notifications")
      .select("type")
      .eq("user_id", userId)
      .eq("type", "club_approved");
    expect(notes.data ?? []).toHaveLength(1);
  });

  test("resolving a report: status and reviewer change", async ({ page }) => {
    const res = await page.request.patch(`/api/admin/reports/${reportId}`, {
      data: { status: "reviewed" },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    const report = await service
      .from("event_reports")
      .select("status, reviewed_by")
      .eq("id", reportId)
      .single();
    expect(report.data).toEqual({ status: "reviewed", reviewed_by: IDS.admin });
  });

  test("approving an organizer request: approved, organizer membership, notification", async ({
    page,
  }) => {
    const res = await page.request.patch(`/api/admin/organizer-requests/${requestId}`, {
      data: { status: "approved" },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    const request = await service
      .from("organizer_requests")
      .select("status, reviewed_by")
      .eq("id", requestId)
      .single();
    expect(request.data).toEqual({ status: "approved", reviewed_by: IDS.admin });

    const membership = await service
      .from("club_members")
      .select("role")
      .eq("club_id", approvedClubId)
      .eq("user_id", userId);
    expect(membership.data).toEqual([{ role: "organizer" }]);

    const notes = await service
      .from("notifications")
      .select("type")
      .eq("user_id", userId)
      .eq("type", "organizer_approved");
    expect(notes.data ?? []).toHaveLength(1);
  });

  test("banning with suspend_content: banned, own club suspended with a review, notification", async ({
    page,
  }) => {
    const res = await page.request.post(`/api/admin/users/${userId}/ban`, {
      data: { reason: "p5 fixture ban", duration_days: 1, suspend_content: true },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    const user = await service
      .from("users")
      .select("banned_at, ban_expires_at, ban_reason, banned_by")
      .eq("id", userId)
      .single();
    expect(user.data?.banned_at).not.toBeNull();
    expect(user.data?.ban_expires_at).not.toBeNull();
    expect(user.data?.ban_reason).toBe("p5 fixture ban");
    expect(user.data?.banned_by).toBe(IDS.admin);

    const club = await service.from("clubs").select("status").eq("id", pendingClubId).single();
    expect(club.data?.status).toBe("suspended");

    const reviews = await service
      .from("moderation_reviews")
      .select("action, author_id")
      .eq("target_id", pendingClubId)
      .eq("action", "suspension");
    expect(reviews.data).toEqual([{ action: "suspension", author_id: IDS.admin }]);

    const notes = await service
      .from("notifications")
      .select("type")
      .eq("user_id", userId)
      .eq("type", "user_banned");
    expect(notes.data ?? []).toHaveLength(1);
  });

  test("unbanning: banned_at and ban_expires_at are cleared", async ({ page }) => {
    const res = await page.request.delete(`/api/admin/users/${userId}/ban`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    const user = await service
      .from("users")
      .select("banned_at, ban_expires_at")
      .eq("id", userId)
      .single();
    expect(user.data).toEqual({ banned_at: null, ban_expires_at: null });

    const notes = await service
      .from("notifications")
      .select("type")
      .eq("user_id", userId)
      .eq("type", "user_unbanned");
    expect(notes.data ?? []).toHaveLength(1);
  });
});

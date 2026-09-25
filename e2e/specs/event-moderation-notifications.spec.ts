/**
 * event-moderation-notifications.spec.ts — an admin's event decisions write
 * exactly one creator notification per decision type, and the creator's
 * appeal still passes the events guard, on the real stack.
 *
 * Phase 05-slices-3-5-auth-club-authorization-admin-containment · REVIEW-05
 * iteration 3
 *
 * WHAT IS UNDER TEST
 *   - iter3 WR-07. `PATCH /api/admin/events/[id]/status` upserted the
 *     approval notification with `onConflict: "user_id,event_id,type"`, which
 *     Postgres cannot match to the PARTIAL `notifications_dedup_idx` (42P10),
 *     so no approval notification was ever written. The rejection and
 *     suspension arms inserted, which collides (23505) on a repeat decision.
 *     The handler now reads the existing row and updates or inserts it. So:
 *     an approval writes exactly one `event_approved` row; a second approval
 *     or a second suspension refreshes the one row (new text, unread) rather
 *     than failing or duplicating it.
 *   - iter3 WR-02. The events guard now requires an appeal to raise
 *     `appeal_count` by exactly one. The real `POST /api/events/[id]/appeal`
 *     (which writes `appeal_count + 1` on the cookie client) must still pass
 *     it. The direct uncounted reset it refuses is pinned by pgTAP
 *     `066-events-appeal-increment.test.sql` under the `authenticated` role.
 *
 * THE FIXTURE. `beforeAll` inserts one PENDING event created by the seeded
 * `onboarded_student`, with no club, titled with FIXTURE_PREFIX, using the
 * LOCAL service key from `localStackEnv()` (already passed through
 * `assertSeedTargetAllowed` by playwright.config.ts). `afterAll` removes it and
 * every notification, moderation review and audit row keyed on it, and proves
 * they are gone. No seeded row is written. No re-authentication: the admin
 * and the student act through their storage states.
 *
 * NOTHING SECRET IS PRINTED.
 */

import { randomUUID } from "node:crypto";

import { expect, test, type APIRequestContext } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { localStackEnv } from "../env";
import { IDS, storageStateFor } from "../fixtures";

const FIXTURE_PREFIX = "p5-iter3-moderation-notes-fixture";
const CREATOR = IDS.onboarded_student;

test.describe.serial("event moderation notifications (REVIEW-05 iter3 WR-07, WR-02)", () => {
  test.use({ storageState: storageStateFor("admin") });

  let service: SupabaseClient;
  const eventId = randomUUID();

  async function fixtureEventIds(): Promise<string[]> {
    const { data, error } = await service
      .from("events")
      .select("id")
      .like("title", `${FIXTURE_PREFIX}%`);
    expect(error).toBeNull();
    return (data ?? []).map((row: { id: string }) => row.id);
  }

  async function removeFixtures(): Promise<void> {
    const ids = await fixtureEventIds();
    if (ids.length === 0) return;
    const ok = (label: string, result: { error: unknown }) =>
      expect(result.error, label).toBeNull();
    ok("notifications", await service.from("notifications").delete().in("event_id", ids));
    ok("reviews", await service.from("moderation_reviews").delete().in("target_id", ids));
    ok("audit", await service.from("admin_audit_log").delete().in("target_id", ids));
    ok("events", await service.from("events").delete().in("id", ids));
  }

  async function creatorNotes(type: string) {
    const { data, error } = await service
      .from("notifications")
      .select("id, message, read")
      .eq("user_id", CREATOR)
      .eq("event_id", eventId)
      .eq("type", type);
    expect(error).toBeNull();
    return data ?? [];
  }

  async function decide(
    request: APIRequestContext,
    body: Record<string, unknown>
  ): Promise<void> {
    const res = await request.patch(`/api/admin/events/${eventId}/status`, { data: body });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  }

  test.beforeAll(async () => {
    const stack = localStackEnv();
    service = createClient(stack.url, stack.serviceRoleKey, {
      auth: { persistSession: false },
    });
    await removeFixtures();

    const inserted = await service.from("events").insert({
      id: eventId,
      title: `${FIXTURE_PREFIX} ${eventId.slice(0, 8)}`,
      description: "Temporary fixture for event-moderation-notifications.spec.ts.",
      location: "Leacock 132",
      start_date: "2031-05-01T18:00:00Z",
      end_date: "2031-05-01T20:00:00Z",
      tags: ["academic"],
      club_id: null,
      created_by: CREATOR,
      status: "pending",
    });
    expect(inserted.error).toBeNull();
  });

  test.afterAll(async () => {
    await removeFixtures();
    expect(await fixtureEventIds()).toHaveLength(0);
    for (const [table, column] of [
      ["notifications", "event_id"],
      ["moderation_reviews", "target_id"],
      ["admin_audit_log", "target_id"],
    ] as const) {
      const left = await service.from(table).select("id").eq(column, eventId);
      expect(left.error).toBeNull();
      expect(left.data ?? [], `${table} residue`).toHaveLength(0);
    }
  });

  test("an approval writes exactly one event_approved notification", async ({ page }) => {
    await decide(page.request, { status: "approved" });
    const notes = await creatorNotes("event_approved");
    expect(notes).toHaveLength(1);
    expect(notes[0].read).toBe(false);
  });

  test("a suspension writes one event_suspended notification", async ({ page }) => {
    await decide(page.request, { status: "suspended", category: "other", message: "First pause" });
    const notes = await creatorNotes("event_suspended");
    expect(notes).toHaveLength(1);
    expect(notes[0].message).toContain("First pause");
  });

  test("a second approval refreshes the one event_approved row, unread again", async ({ page }) => {
    // The creator reads it first, so the refresh is visible.
    const [before] = await creatorNotes("event_approved");
    const marked = await service.from("notifications").update({ read: true }).eq("id", before.id);
    expect(marked.error).toBeNull();

    await decide(page.request, { status: "approved" });
    const notes = await creatorNotes("event_approved");
    expect(notes).toHaveLength(1);
    expect(notes[0].id).toBe(before.id);
    expect(notes[0].read).toBe(false);
  });

  test("a second suspension refreshes the one event_suspended row with the new reason", async ({
    page,
  }) => {
    await decide(page.request, { status: "suspended", category: "other", message: "Second pause" });
    const notes = await creatorNotes("event_suspended");
    expect(notes).toHaveLength(1);
    expect(notes[0].message).toContain("Second pause");
  });

  test("the creator's appeal through the real route passes the events guard (+1)", async ({
    playwright,
    baseURL,
  }) => {
    const student = await playwright.request.newContext({
      baseURL,
      storageState: storageStateFor("onboarded_student"),
    });
    try {
      const res = await student.post(`/api/events/${eventId}/appeal`, {
        data: { message: "Please take another look." },
      });
      expect(res.status()).toBe(200);
      expect((await res.json()).success).toBe(true);
    } finally {
      await student.dispose();
    }
    const row = await service
      .from("events")
      .select("status, appeal_count")
      .eq("id", eventId)
      .single();
    expect(row.error).toBeNull();
    expect(row.data).toEqual({ status: "pending", appeal_count: 1 });
  });

  test("a rejection after the appeal writes one event_rejected notification", async ({ page }) => {
    await decide(page.request, { status: "rejected", category: "other", message: "Still no" });
    const notes = await creatorNotes("event_rejected");
    expect(notes).toHaveLength(1);
    expect(notes[0].message).toContain("Still no");
    // Every decision above left exactly one row per type.
    expect(await creatorNotes("event_approved")).toHaveLength(1);
    expect(await creatorNotes("event_suspended")).toHaveLength(1);
  });
});

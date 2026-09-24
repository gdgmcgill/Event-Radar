/**
 * admin-audit-row.spec.ts — one moderation action writes exactly one audit row.
 *
 * Phase 05-slices-3-5-auth-club-authorization-admin-containment · plan 05-14
 *
 * WHAT IS UNDER TEST (F-073, DEC-46; the F-007 validation)
 *   Before 05-14, `logAdminAction` inserted an `admin_email` key into
 *   `admin_audit_log`, a column the schema does not have. PostgREST rejected
 *   every insert (PGRST204) and nothing read the result, so no moderation
 *   action was ever recorded. 05-14 writes through the elevated door without
 *   the column. This spec proves it on the real stack: the admin approves a
 *   pending fixture event through `PATCH /api/admin/events/[id]/status`, and
 *   `admin_audit_log` gains exactly one row for that event, action
 *   `approved`, `admin_user_id` the seeded admin. The moderation dashboard's
 *   Recent Activity then shows the action with the actor resolved by id
 *   (F-072).
 *
 * WHY THE FIXTURE IS CREATED HERE (DEC-54)
 *   The seed is not changed in Phase 5, and approving a seeded pending event
 *   would change a row other specs read. `beforeAll` inserts its own pending
 *   event (title prefixed `p5-audit-fixture`, `created_by` null so no
 *   notification is addressed to a seeded user) with the LOCAL service key
 *   from `localStackEnv()`, which playwright.config.ts has already passed
 *   through `assertSeedTargetAllowed`. `afterAll` deletes the fixture's audit
 *   rows, notifications and the event, and proves all three are gone. No
 *   seeded row is read for writing or written.
 *
 * NOTHING SECRET IS PRINTED. The service key never appears in a log line or an
 * assertion message.
 */

import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { localStackEnv } from "../env";
import { IDS, storageStateFor } from "../fixtures";

const FIXTURE_PREFIX = "p5-audit-fixture";

test.describe.serial("a moderation action writes exactly one audit row (F-073)", () => {
  test.use({ storageState: storageStateFor("admin") });

  let service: SupabaseClient;
  const fixtureId = randomUUID();
  const fixtureTitle = `${FIXTURE_PREFIX} ${fixtureId.slice(0, 8)}`;

  async function auditRowsForFixture() {
    const { data, error } = await service
      .from("admin_audit_log")
      .select("id, admin_user_id, action, target_type, target_id")
      .eq("target_id", fixtureId);
    expect(error).toBeNull();
    return data ?? [];
  }

  /** Every leftover fixture event from a crashed run, by title prefix. */
  async function leftoverFixtureIds(): Promise<string[]> {
    const { data, error } = await service
      .from("events")
      .select("id")
      .like("title", `${FIXTURE_PREFIX}%`);
    expect(error).toBeNull();
    return (data ?? []).map((row: { id: string }) => row.id);
  }

  async function removeFixtures(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const audit = await service.from("admin_audit_log").delete().in("target_id", ids);
    expect(audit.error).toBeNull();
    const notes = await service.from("notifications").delete().in("event_id", ids);
    expect(notes.error).toBeNull();
    const events = await service.from("events").delete().in("id", ids);
    expect(events.error).toBeNull();
  }

  test.beforeAll(async () => {
    const stack = localStackEnv();
    service = createClient(stack.url, stack.serviceRoleKey, {
      auth: { persistSession: false },
    });

    await removeFixtures(await leftoverFixtureIds());

    const start = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const inserted = await service.from("events").insert({
      id: fixtureId,
      title: fixtureTitle,
      description: "Temporary fixture for admin-audit-row.spec.ts; removed in afterAll.",
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      location: "Test fixture",
      status: "pending",
      created_by: null,
    });
    expect(inserted.error).toBeNull();
  });

  test.afterAll(async () => {
    await removeFixtures([fixtureId]);

    expect(await auditRowsForFixture()).toHaveLength(0);
    const notes = await service
      .from("notifications")
      .select("id")
      .eq("event_id", fixtureId);
    expect(notes.error).toBeNull();
    expect(notes.data ?? []).toHaveLength(0);
    expect(await leftoverFixtureIds()).toHaveLength(0);
  });

  test("FIXED F-073: approving the fixture writes exactly one audit row", async ({
    page,
  }) => {
    expect(await auditRowsForFixture()).toHaveLength(0);

    const res = await page.request.patch(`/api/admin/events/${fixtureId}/status`, {
      data: { status: "approved" },
    });
    expect(res.status()).toBe(200);

    const rows = await auditRowsForFixture();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      admin_user_id: IDS.admin,
      action: "approved",
      target_type: "event",
      target_id: fixtureId,
    });
  });

  test("FIXED F-072: Recent Activity shows the action and the actor by name", async ({
    page,
  }) => {
    await page.goto("/moderation");
    await expect(page.getByRole("heading", { name: "Recent Activity" })).toBeVisible();
    await expect(page.getByText("No recent activity yet")).toHaveCount(0);

    // The audit row renders `<actor> <action> <target_type> <target name>` in
    // one line; the target name is the fixture's title from the row's
    // metadata, and the fixture is no longer in the pending list, so this is
    // the only place on the page the title appears.
    const target = page.getByText(fixtureTitle, { exact: true });
    await expect(target).toHaveCount(1);
    const line = target.locator("xpath=..");
    await expect(line).toContainText("Seed Admin");
    await expect(line).toContainText("approved");
  });
});

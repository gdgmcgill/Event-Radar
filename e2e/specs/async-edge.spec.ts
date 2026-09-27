/**
 * async-edge.spec.ts — slice 6's three route fixes on the real stack.
 *
 * Phase 06-slices-6-7-async-edge-contracts-caching-observability · plan 06-04
 *
 * WHAT IS UNDER TEST
 *   - F-028 (DEC-69). An anonymous GET /api/notifications/count answers
 *     401 {"error":"Unauthorized"}; it answered 200 {"unread_count":0}.
 *   - F-092 (DEC-69). GET /api/admin/reports answers 200 and carries each
 *     report's reporter as { id, display_name, avatar_url }. It answered 500
 *     for every admin: the `users!event_reports_reporter_id_fkey` embed has
 *     no relationship (reporter_id references auth.users), so PostgREST
 *     refused it with PGRST200.
 *   - F-017 (DEC-68). A non-admin with scores is assigned an A/B variant, and
 *     the assignment row is written through the elevated door keyed by the
 *     caller's own id. Before, experiments and experiment_variants were read
 *     on the cookie client, whose admin-only policies hid them, so only
 *     admins were ever assigned.
 *
 * THE FIXTURES. The student's report, the admin's experiment, its two
 * variants and its activation are created through the product routes. The
 * student's score row is inserted through the LOCAL service client from
 * `localStackEnv()` (already passed through `assertSeedTargetAllowed` by
 * playwright.config.ts): the admin batch route cannot produce it, because
 * `compute_user_scores()` begins with an unqualified `DELETE FROM
 * user_event_scores`, which pg_safeupdate refuses for every PostgREST
 * request (`authenticator` preloads safeupdate), so POST
 * /api/recommendations/batch answers 500 `DELETE requires a WHERE clause`
 * (21000) on this stack; pg_cron, which runs as postgres, is unaffected.
 * That is registered as DI-82, not worked around in product code. Every row
 * is removed in afterAll; the seeded baseline has no user_event_scores rows
 * (asserted before the fixture row is written), so all of them are removed.
 * No seeded row is written.
 *
 * NOTHING SECRET IS PRINTED.
 */

import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { localStackEnv } from "../env";
import { IDS, storageStateFor } from "../fixtures";

const EXPERIMENT_NAME = "p6-async-edge-experiment-fixture";
const STUDENT = IDS.onboarded_student;
const STUDENT_NAME = "Seed Onboarded Student";

let service: SupabaseClient;

test.beforeAll(() => {
  const stack = localStackEnv();
  service = createClient(stack.url, stack.serviceRoleKey, {
    auth: { persistSession: false },
  });
});

// ─── F-028 ────────────────────────────────────────────────────────────────────

test("FIXED F-028: an anonymous notifications count answers 401", async ({
  playwright,
  baseURL,
}) => {
  const anonymous = await playwright.request.newContext({ baseURL });
  try {
    const res = await anonymous.get("/api/notifications/count");
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  } finally {
    await anonymous.dispose();
  }
});

// ─── F-092 ────────────────────────────────────────────────────────────────────

test.describe.serial("FIXED F-092: the admin reports list", () => {
  async function removeReport(): Promise<void> {
    const { error } = await service
      .from("event_reports")
      .delete()
      .eq("event_id", IDS.approvedEvent)
      .eq("reporter_id", STUDENT);
    expect(error).toBeNull();
  }

  test.beforeAll(removeReport);

  test.afterAll(async () => {
    await removeReport();
    const { data, error } = await service
      .from("event_reports")
      .select("id")
      .eq("event_id", IDS.approvedEvent)
      .eq("reporter_id", STUDENT);
    expect(error).toBeNull();
    expect(data ?? [], "event_reports residue").toHaveLength(0);
  });

  test("a student's report reaches the admin list with the reporter's name", async ({
    playwright,
    baseURL,
  }) => {
    const student = await playwright.request.newContext({
      baseURL,
      storageState: storageStateFor("onboarded_student"),
    });
    try {
      const filed = await student.post(`/api/events/${IDS.approvedEvent}/report`, {
        data: { category: "other", message: "p6 async-edge spec report" },
      });
      expect(filed.status()).toBe(201);
    } finally {
      await student.dispose();
    }

    const admin = await playwright.request.newContext({
      baseURL,
      storageState: storageStateFor("admin"),
    });
    try {
      const res = await admin.get(`/api/admin/reports?event_id=${IDS.approvedEvent}`);
      expect(res.status()).toBe(200);
      const body = (await res.json()) as {
        reports: Array<{
          reporter_id: string;
          reporter: { id: string; display_name: string | null; avatar_url: string | null } | null;
          event: { id: string };
          report_count: number;
        }>;
      };
      const mine = body.reports.filter((r) => r.reporter_id === STUDENT);
      expect(mine).toHaveLength(1);
      expect(mine[0].event.id).toBe(IDS.approvedEvent);
      const profile = await service
        .from("users")
        .select("name, avatar_url")
        .eq("id", STUDENT)
        .single();
      expect(profile.error).toBeNull();
      expect(profile.data?.name).toBe(STUDENT_NAME);
      // Exactly the three keys the moderation page renders; no email.
      expect(mine[0].reporter).toStrictEqual({
        id: STUDENT,
        display_name: STUDENT_NAME,
        avatar_url: profile.data?.avatar_url ?? null,
      });
      expect(mine[0].report_count).toBeGreaterThanOrEqual(1);
    } finally {
      await admin.dispose();
    }
  });
});

// ─── F-017 ────────────────────────────────────────────────────────────────────

test.describe.serial("FIXED F-017: a non-admin is assigned an A/B variant", () => {
  async function fixtureExperimentIds(): Promise<string[]> {
    const { data, error } = await service
      .from("experiments")
      .select("id")
      .eq("name", EXPERIMENT_NAME);
    expect(error).toBeNull();
    return (data ?? []).map((row: { id: string }) => row.id);
  }

  const ok = (label: string, result: { error: unknown }) =>
    expect(result.error, label).toBeNull();

  async function removeExperimentFixtures(): Promise<void> {
    const ids = await fixtureExperimentIds();
    if (ids.length === 0) return;
    ok("assignments", await service.from("experiment_assignments").delete().in("experiment_id", ids));
    ok("variants", await service.from("experiment_variants").delete().in("experiment_id", ids));
    ok("experiments", await service.from("experiments").delete().in("id", ids));
  }

  test.beforeAll(async () => {
    await removeExperimentFixtures();
    const running = await service.from("experiments").select("id").eq("status", "running");
    expect(running.error).toBeNull();
    expect(running.data ?? [], "no other running experiment").toHaveLength(0);
    const scores = await service.from("user_event_scores").select("user_id").limit(1);
    expect(scores.error).toBeNull();
    expect(scores.data ?? [], "the seeded baseline has no score rows").toHaveLength(0);
  });

  test.afterAll(async () => {
    await removeExperimentFixtures();
    // The seeded baseline has no score rows (asserted in beforeAll), so every
    // score row is this spec's fixture.
    ok("scores", await service.from("user_event_scores").delete().not("user_id", "is", null));
    expect(await fixtureExperimentIds()).toHaveLength(0);
    const scores = await service.from("user_event_scores").select("user_id").limit(1);
    expect(scores.error).toBeNull();
    expect(scores.data ?? [], "user_event_scores residue").toHaveLength(0);
  });

  test("the student's recommendations assign exactly one variant, keyed by the student", async ({
    playwright,
    baseURL,
  }) => {
    const admin = await playwright.request.newContext({
      baseURL,
      storageState: storageStateFor("admin"),
    });
    let experimentId: string;
    let variantIds: string[];
    try {
      const created = await admin.post("/api/admin/experiments", {
        data: {
          name: EXPERIMENT_NAME,
          description: "Temporary fixture for async-edge.spec.ts.",
          variants: [
            { name: "control", config: { lambda: 1 }, weight: 1 },
            { name: "diverse", config: { lambda: 0 }, weight: 1 },
          ],
        },
      });
      expect(created.status()).toBe(201);
      const experiment = (await created.json()).experiment as {
        id: string;
        variants: Array<{ id: string }>;
      };
      experimentId = experiment.id;
      variantIds = experiment.variants.map((v) => v.id);
      expect(variantIds).toHaveLength(2);

      const activated = await admin.patch(`/api/admin/experiments/${experimentId}`, {
        data: { status: "running" },
      });
      expect(activated.status()).toBe(200);
      expect((await activated.json()).experiment.status).toBe("running");
    } finally {
      await admin.dispose();
    }

    // The student's precomputed score for the seeded approved future event,
    // so the route takes the personalized path and reaches the experiment
    // block (the batch route cannot write it: DI-82, see the header).
    ok(
      "score fixture",
      await service.from("user_event_scores").insert({
        user_id: STUDENT,
        event_id: IDS.approvedEvent,
        score: 0.5,
        breakdown: { tag: 0.35, interaction: 0, popularity: 0.1, recency: 0.05, social: 0 },
      })
    );

    const student = await playwright.request.newContext({
      baseURL,
      storageState: storageStateFor("onboarded_student"),
    });
    let reported: string | null;
    try {
      const res = await student.get("/api/recommendations");
      expect(res.status()).toBe(200);
      const body = (await res.json()) as {
        source: string;
        experiment_variant_id: string | null;
      };
      expect(body.source).toBe("personalized");
      reported = body.experiment_variant_id;
    } finally {
      await student.dispose();
    }

    const { data: rows, error } = await service
      .from("experiment_assignments")
      .select("user_id, variant_id")
      .eq("experiment_id", experimentId)
      .eq("user_id", STUDENT);
    expect(error).toBeNull();
    expect(rows ?? []).toHaveLength(1);
    expect(variantIds).toContain(rows![0].variant_id);
    expect(reported).toBe(rows![0].variant_id);
  });
});

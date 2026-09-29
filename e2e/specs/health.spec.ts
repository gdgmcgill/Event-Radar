/**
 * health.spec.ts — `/api/health` and the `/health` page against a production
 * build, the real proxy and the seeded local database.
 *
 * Phase 06-slices-6-7-async-edge-contracts-caching-observability · plan 06-17
 * (REFAC-22, F-029, DEC-78, DEC-79)
 *
 * WHAT IS PINNED
 *   - An anonymous GET answers 200 with exactly `{ status: "ok", version }`,
 *     `Cache-Control: private, no-store` and a UUID `x-request-id` (F-029).
 *   - The admin's GET answers the documented report (`docs/health.md`): the
 *     five checks, the three pg_cron jobs by name (the jobs 06-05 scheduled
 *     locally) and `checks.webhook.last_ingest_at` null, because the seed
 *     inserts no instagram-sourced event. The HTTP code agrees with the
 *     overall status (200 for "ok", 503 otherwise).
 *   - The `/health` page redirects an anonymous caller to "/" and renders the
 *     overall status for the admin.
 *
 * READ-ONLY: health writes nothing.
 */

import { expect, test } from "@playwright/test";

import { storageStateFor } from "../fixtures";

const HEALTH = "/api/health";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOBS = ["compute-user-scores", "send-event-reminders", "send-feedback-requests"];

test.describe("an anonymous caller", () => {
  test("GET /api/health answers liveness only, private, with a request id", async ({
    playwright,
    baseURL,
  }) => {
    const anonymous = await playwright.request.newContext({ baseURL });
    try {
      const res = await anonymous.get(HEALTH);
      expect(res.status()).toBe(200);
      expect(res.headers()["cache-control"]).toBe("private, no-store");
      expect(res.headers()["x-request-id"] ?? "").toMatch(UUID);
      const body = (await res.json()) as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual(["status", "version"]);
      expect(body.status).toBe("ok");
      expect(typeof body.version).toBe("string");
    } finally {
      await anonymous.dispose();
    }
  });

  test("the /health page redirects to /", async ({ page }) => {
    await page.goto("/health");
    await expect(page).toHaveURL((url) => url.pathname === "/");
  });
});

test.describe("an admin", () => {
  test.use({ storageState: storageStateFor("admin") });

  test("GET /api/health answers the documented report", async ({ page }) => {
    const res = await page.request.get(HEALTH);
    expect(res.headers()["cache-control"]).toBe("private, no-store");
    expect(res.headers()["x-request-id"] ?? "").toMatch(UUID);

    const body = (await res.json()) as {
      status: string;
      version: string;
      ts: string;
      checks: {
        db: { status: string; latency_ms: number };
        auth: { status: string; latency_ms: number };
        storage: { status: string; latency_ms: number };
        pg_cron: { status: string; jobs: { jobname: string }[] };
        webhook: { last_ingest_at: string | null } & Record<string, unknown>;
      };
    };
    expect(Object.keys(body).sort()).toEqual(["checks", "status", "ts", "version"]);
    expect(Object.keys(body.checks).sort()).toEqual(["auth", "db", "pg_cron", "storage", "webhook"]);
    expect(["ok", "degraded", "down"]).toContain(body.status);
    expect(res.status()).toBe(body.status === "ok" ? 200 : 503);
    expect(body.checks.db.status).toBe("ok");
    expect(body.checks.pg_cron.jobs.map((j) => j.jobname).sort()).toEqual(JOBS);
    expect(body.checks.webhook.last_ingest_at).toBeNull();
    // M3 P1-07: delivery freshness and the pending queue ride along.
    expect(Object.keys(body.checks.webhook).sort()).toEqual([
      "last_delivery_at", "last_error_code", "last_failure_at", "last_ingest_at",
      "last_success_at", "pending_review", "stale_pending",
    ]);
  });

  test("the /health page renders the overall status", async ({ page }) => {
    const res = await page.goto("/health");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL((url) => url.pathname === "/health");
    const status = page.getByTestId("health-overall-status");
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute("data-status", /^(ok|degraded|down)$/);
    await expect(page.getByTestId("health-cron-job")).toHaveCount(JOBS.length);
  });
});

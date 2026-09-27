/**
 * GET /api/health — liveness for everyone, the documented report for an
 * active admin or the uptime monitor (plan 06-17, REFAC-22, DEC-78, F-029).
 *
 * The shapes, the auth modes, every check's source and threshold and the
 * status rules are documented in `docs/health.md`; the schemas are
 * `HealthLiveness` and `HealthReport` in `src/contracts/health.ts`.
 *
 * WHO GETS WHAT
 *   - `Authorization: Bearer <HEALTH_TOKEN>`, when `healthToken()` is set
 *     (32+ characters): the report. The bearer and the token are hashed with
 *     SHA-256 and the digests compared with `timingSafeEqual`, so the compare
 *     takes the same time whatever the bearer's length or content. No token
 *     configured means the token arm is off, never an empty comparison.
 *   - otherwise the caller is read through the request context (the
 *     revalidating user read, never the session accessor): `requireActiveUser`
 *     then `requireRole(ctx, "admin")`. A banned admin is refused by the
 *     first, exactly as every admin API is.
 *   - everyone else: 200 `{ status: "ok", version }`, which says only that
 *     this process answers.
 *
 * WHAT THE REPORT NEVER CARRIES
 *   An error's text, a variable name, memory figures or OAuth provider state.
 *   A failing check is logged with its code (or its error's name) only, and
 *   answered as a status. The old OAuth-provider, environment, memory and
 *   session checks are deleted (the F-029 leak surface).
 *
 * Always `private, no-store` with an `x-request-id` (the wrapper's private
 * class): a CDN-cached "ok" would mask an origin outage (research C8).
 */

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Liveness, and the dependency report for admins and monitors
 *     description: >
 *       Anyone gets { status, version }. An active admin session, or
 *       Authorization Bearer HEALTH_TOKEN, gets the report of db, auth,
 *       storage, pg_cron and webhook. See docs/health.md.
 *     responses:
 *       200:
 *         description: Alive (liveness), or the report with status ok
 *         content:
 *           application/json:
 *             example:
 *               status: ok
 *               version: "0.1.0"
 *       503:
 *         description: The report with status degraded or down
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type {
  HealthCronJob,
  HealthLiveness,
  HealthPgCron,
  HealthProbe,
  HealthReport,
  HealthStatus,
  HealthWebhook,
} from "@/contracts/health";
import { healthToken, supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { createRequestContext, type ServerSupabaseClient } from "@/server/context";
import { getElevatedClient } from "@/server/db/elevated";
import { log } from "@/server/log";
import { withRoute } from "@/server/route";

/** How long the auth and storage probes may take before they count as down. */
const PROBE_TIMEOUT_MS = 3_000;

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/**
 * Twice each job's schedule (DEC-78): compute-user-scores runs every 6 h,
 * send-event-reminders every 15 min, send-feedback-requests every 30 min. A
 * job not named here is listed with `stale: null` and does not move the
 * pg_cron status.
 */
const STALE_AFTER_MS: Readonly<Record<string, number>> = {
  "compute-user-scores": 12 * HOUR_MS,
  "send-event-reminders": 30 * MINUTE_MS,
  "send-feedback-requests": 60 * MINUTE_MS,
};

function version(): string {
  return process.env.npm_package_version || "0.1.0";
}

/** The error's code, else its name; never its text. */
function codeOf(error: unknown): string {
  if (error && typeof error === "object") {
    const { code, name } = error as { code?: unknown; name?: unknown };
    if (typeof code === "string" && code !== "") return code;
    if (typeof name === "string" && name !== "") return name;
  }
  return "unknown";
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** True only when a token is configured and the bearer equals it. */
function bearerMatches(request: NextRequest): boolean {
  const token = healthToken();
  if (token === null) return false;
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return false;
  return timingSafeEqual(sha256(match[1].trim()), sha256(token));
}

// ─── The checks ─────────────────────────────────────────────────────────────

async function checkDb(supabase: ServerSupabaseClient): Promise<HealthProbe> {
  const started = Date.now();
  try {
    const { error } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (error) {
      log.warn("health check failed", { scope: "Health", check: "db", code: codeOf(error) });
      return { status: "down", latency_ms: Date.now() - started };
    }
    return { status: "ok", latency_ms: Date.now() - started };
  } catch (error) {
    log.warn("health check failed", { scope: "Health", check: "db", code: codeOf(error) });
    return { status: "down", latency_ms: Date.now() - started };
  }
}

async function probe(check: "auth" | "storage", path: string): Promise<HealthProbe> {
  const started = Date.now();
  try {
    const response = await fetch(`${supabaseUrl()}${path}`, {
      headers: { apikey: supabaseAnonKey() },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
    });
    if (response.status !== 200) {
      log.warn("health check failed", { scope: "Health", check, code: `HTTP_${response.status}` });
      return { status: "down", latency_ms: Date.now() - started };
    }
    return { status: "ok", latency_ms: Date.now() - started };
  } catch (error) {
    log.warn("health check failed", { scope: "Health", check, code: codeOf(error) });
    return { status: "down", latency_ms: Date.now() - started };
  }
}

type CronRow = {
  jobname: string;
  schedule: string;
  active: boolean;
  last_start: string | null;
  last_status: string | null;
};

function toJob(row: CronRow, now: number): HealthCronJob {
  const threshold = STALE_AFTER_MS[row.jobname];
  const started = row.last_start === null ? Number.NaN : Date.parse(row.last_start);
  const stale =
    threshold === undefined || Number.isNaN(started) ? null : now - started > threshold;
  return {
    jobname: row.jobname,
    schedule: row.schedule,
    active: row.active,
    last_start: Number.isNaN(started) ? null : new Date(started).toISOString(),
    last_status: row.last_status ?? null,
    stale,
  };
}

/**
 * `cron_job_status()` is service_role only (C4), so it is read through the
 * door. PGRST202 (production before the DI-23 repair) or any other failure is
 * `unknown`, never a 500.
 */
async function checkPgCron(): Promise<HealthPgCron> {
  try {
    const { data, error } = await getElevatedClient().rpc("cron_job_status");
    if (error) {
      log.warn("health check failed", { scope: "Health", check: "pg_cron", code: codeOf(error) });
      return { status: "unknown", jobs: [] };
    }
    const now = Date.now();
    const jobs = ((data ?? []) as CronRow[]).map((row) => toJob(row, now));
    const known = jobs.filter((job) => job.jobname in STALE_AFTER_MS);
    const status: HealthPgCron["status"] =
      known.length === 0
        ? "unknown"
        : known.some((job) => job.stale === true)
          ? "stale"
          : known.some((job) => job.stale === null)
            ? "unknown"
            : "ok";
    return { status, jobs };
  } catch (error) {
    log.warn("health check failed", { scope: "Health", check: "pg_cron", code: codeOf(error) });
    return { status: "unknown", jobs: [] };
  }
}

/**
 * The newest scraper-sourced insert, by any path (C23). Read through the door:
 * a pending instagram event is visible only to admins through RLS, and the
 * token caller has no session.
 */
async function checkWebhook(): Promise<HealthWebhook> {
  try {
    const { data, error } = await getElevatedClient()
      .from("events")
      .select("created_at")
      .eq("source", "instagram")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      log.warn("health check failed", { scope: "Health", check: "webhook", code: codeOf(error) });
      return { last_ingest_at: null };
    }
    const created = data?.created_at ? Date.parse(data.created_at) : Number.NaN;
    return { last_ingest_at: Number.isNaN(created) ? null : new Date(created).toISOString() };
  } catch (error) {
    log.warn("health check failed", { scope: "Health", check: "webhook", code: codeOf(error) });
    return { last_ingest_at: null };
  }
}

function overall(checks: HealthReport["checks"]): HealthStatus {
  if (checks.db.status === "down") return "down";
  if (
    checks.auth.status === "down" ||
    checks.storage.status === "down" ||
    checks.pg_cron.status === "stale"
  ) {
    return "degraded";
  }
  return "ok";
}

async function report(supabase: ServerSupabaseClient): Promise<NextResponse> {
  const [db, auth, storage, pg_cron, webhook] = await Promise.all([
    checkDb(supabase),
    probe("auth", "/auth/v1/health"),
    probe("storage", "/storage/v1/status"),
    checkPgCron(),
    checkWebhook(),
  ]);
  const checks = { db, auth, storage, pg_cron, webhook };
  const status = overall(checks);
  const body: HealthReport = {
    status,
    version: version(),
    ts: new Date().toISOString(),
    checks,
  };
  return NextResponse.json(body, { status: status === "ok" ? 200 : 503 });
}

export const GET = withRoute({ cache: "private", action: "check health" }, async (
  request: NextRequest
) => {
  if (bearerMatches(request)) {
    return report(await createClient());
  }

  const ctx = await createRequestContext();
  const active = requireActiveUser(ctx);
  const admin = active.ok ? requireRole(ctx, "admin") : active;
  if (admin.ok) {
    return report(ctx.supabase);
  }

  const body: HealthLiveness = { status: "ok", version: version() };
  return NextResponse.json(body);
});

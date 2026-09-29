/**
 * The GET /api/health contract (plan 06-17, REFAC-22, DEC-78).
 *
 * Two shapes, documented in `docs/health.md`:
 *   - HealthLiveness, for every caller: `{ status: "ok", version }` and
 *     nothing else;
 *   - HealthReport, for an active admin or the uptime monitor's
 *     `HEALTH_TOKEN`: `{ status, version, ts, checks: { db, auth, storage,
 *     pg_cron, webhook } }`.
 *
 * Both are strict: a key outside the documented shape (an error's text, a
 * variable name, a memory figure) fails to parse, which is how the route's
 * suite and the `/health` page tell the two apart.
 *
 * The overall status: "down" when db is down; "degraded" when auth or storage
 * is down or pg_cron is stale; otherwise "ok". pg_cron "unknown" (the function
 * is missing, or a job never ran) and the webhook field are informational and
 * never change the overall status.
 */
import { z } from "zod";

/** The overall status; the HTTP code is 200 for "ok" and 503 otherwise. */
export const HEALTH_STATUSES = ["ok", "degraded", "down"] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

/** A dependency probe: answered in time with a 200 (or no error), or not. */
export const PROBE_STATUSES = ["ok", "down"] as const;

/** pg_cron freshness: every known job fresh, one stale, or not knowable. */
export const PG_CRON_STATUSES = ["ok", "stale", "unknown"] as const;

export const HealthLiveness = z.strictObject({
  status: z.literal("ok"),
  version: z.string(),
});

export const HealthProbe = z.strictObject({
  status: z.enum(PROBE_STATUSES),
  latency_ms: z.number().int().nonnegative(),
});

export const HealthCronJob = z.strictObject({
  jobname: z.string(),
  schedule: z.string(),
  active: z.boolean(),
  /** ISO timestamp of the newest run's start; null when the job never ran. */
  last_start: z.string().nullable(),
  /** pg_cron's status of that run ("succeeded", "failed", …); null when none. */
  last_status: z.string().nullable(),
  /** Older than twice the job's schedule; null when never run or unthresholded. */
  stale: z.boolean().nullable(),
});

export const HealthPgCron = z.strictObject({
  status: z.enum(PG_CRON_STATUSES),
  jobs: z.array(HealthCronJob),
});

export const HealthWebhook = z.strictObject({
  /**
   * The newest `created_at` of an `instagram`-sourced event, by any insert
   * path; null when there is none. Not proof of delivery through the edge
   * function (research C23).
   */
  last_ingest_at: z.string().nullable(),
  /** M3 P1-07: the newest signed delivery the webhook recorded, any outcome. */
  last_delivery_at: z.string().nullable(),
  /** The newest succeeded, partial, duplicate or heartbeat delivery. */
  last_success_at: z.string().nullable(),
  /** The newest failed or rejected delivery. */
  last_failure_at: z.string().nullable(),
  /** That failure's short snake_case code; null when none. */
  last_error_code: z.string().nullable(),
  /** Pending, non-deleted events; null when the read failed. */
  pending_review: z.number().int().nonnegative().nullable(),
  /** Pending events created over 72 h ago or already past; null when unknown. */
  stale_pending: z.number().int().nonnegative().nullable(),
});

export const HealthReport = z.strictObject({
  status: z.enum(HEALTH_STATUSES),
  version: z.string(),
  ts: z.string(),
  checks: z.strictObject({
    db: HealthProbe,
    auth: HealthProbe,
    storage: HealthProbe,
    pg_cron: HealthPgCron,
    webhook: HealthWebhook,
  }),
});

export type HealthLiveness = z.infer<typeof HealthLiveness>;
export type HealthProbe = z.infer<typeof HealthProbe>;
export type HealthCronJob = z.infer<typeof HealthCronJob>;
export type HealthPgCron = z.infer<typeof HealthPgCron>;
export type HealthWebhook = z.infer<typeof HealthWebhook>;
export type HealthReport = z.infer<typeof HealthReport>;

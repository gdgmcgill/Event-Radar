/**
 * instrumentation.ts — the boot completeness check (DEC-37, REFAC-11).
 *
 * Phase 05-slices-3-5-auth-club-authorization-admin-containment · plan 05-04
 *
 * WHAT IT DOES
 *   Next calls `register()` once when a server instance starts, and the server
 *   does not handle requests until it completes. On the Node.js server runtime
 *   it reads every required variable through its validated reader:
 *   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
 *   `SUPABASE_SERVICE_ROLE_KEY` (through the elevated door's
 *   `assertElevatedConfigured()`, because the lint boundary forbids this file
 *   from importing the service module). The first absent or blank variable
 *   throws `MissingEnvError`. The error is logged once, with the variable's
 *   name and never a value, and rethrown: a server missing its configuration
 *   refuses to start instead of failing request by request.
 *
 * WHEN IT CHECKS NOTHING
 *   - `NEXT_PHASE === "phase-production-build"`: `next build` may load this
 *     file while it collects page data, and CI's build has no service key
 *     (research C8, Assumptions Log A1). The build does not serve traffic.
 *   - `NEXT_RUNTIME !== "nodejs"`: the edge runtime never holds the service
 *     key, and nothing on it constructs an elevated client.
 *
 * The readers themselves stay lazy (src/lib/env.ts). This check runs them
 * early, at server start. It does not move any read to module evaluation.
 *
 * THE RATE-LIMIT STORE (plan 05-18, DEC-50 as amended by DEC-59 Part 2)
 *   `RATE_LIMIT_REQUIRE_DISTRIBUTED` is read first; a value other than
 *   "true"/"false" refuses to start (InvalidEnvError). Then, when
 *   `upstashConfig()` finds no Upstash pair:
 *     - with RATE_LIMIT_REQUIRE_DISTRIBUTED=true, the server refuses to start
 *       with a MissingEnvError naming both pairs (DEC-50's fail-closed boot,
 *       now opt-in);
 *     - otherwise, on Vercel production (`VERCEL_ENV === "production"`), ONE
 *       error is logged naming all four variables and the degradation, and
 *       the server starts: rate limiting runs per instance from the memory
 *       store, which is what production did before this plan. Rate limiting
 *       is not an authorization control, and a boot failure answers every
 *       request 500 (measured in 05-04), so a missing store must not take the
 *       site down;
 *     - otherwise (local, CI, preview) nothing is logged here; the store
 *       selection warns once on first use.
 *   When a pair IS found but its URL is unusable (not https:, a `rediss://`
 *   connection string, a pasted `KV_URL` value — REVIEW-05 CR-02), the same
 *   rule applies: with RATE_LIMIT_REQUIRE_DISTRIBUTED=true the server refuses
 *   to start (InvalidEnvError naming the URL variables, never the value);
 *   otherwise ONE error is logged in every environment and the server starts
 *   on the memory store.
 *
 * LOG LINES (plan 06-12, DEC-74)
 *   Every line is one JSON object from `src/server/log.ts`: the refusal is
 *   `level "error", scope "Config", msg "refusing to start"` with the error's
 *   name and message (a variable NAME, never a value); the store lines are
 *   `scope "RateLimit"` with the constant's text as `msg`. The logger is
 *   imported dynamically on the Node.js branch only, beside the elevated door,
 *   so the edge compilation of this file imports nothing Node-only.
 *
 * SENTRY (plan 06-16, DEC-76, REFAC-21)
 *   On the Node.js branch, outside the build phase, `register()` initializes
 *   Sentry FIRST (`initSentryServer()` from src/sentry.server.config.ts),
 *   before the boot checks, which are unchanged (a refusal is still the one
 *   logged line and the rethrow; this file does not capture it, so a boot
 *   refusal is logged, not sent to Sentry). It never throws: no usable
 *   SENTRY_DSN means
 *   one info line "Sentry disabled" and a disabled SDK; a failing init means
 *   one warn line and the server starts without error reporting.
 *
 *   `onRequestError` is Next's hook for errors it catches while rendering,
 *   in route handlers, server actions and the proxy. It hands the error to
 *   Sentry's `captureRequestError` inside a scope tagged `request_id` when
 *   the request carries a UUID-shaped `x-request-id` (the proxy stamps one on
 *   every request it matches), so a page-render error correlates with its
 *   log lines the same way a route error does. Errors a `withRoute` handler
 *   throws never reach it: the wrapper catches them and captures them itself
 *   (src/server/route.ts). `@sentry/nextjs` resolves to its edge build in an
 *   edge compilation, so the static import is safe on both runtimes.
 */

import type { Instrumentation } from "next";
import { captureRequestError, withScope } from "@sentry/nextjs";
import {
  InvalidEnvError,
  MissingEnvError,
  UPSTASH_ENV_NAMES,
  isVercelProduction,
  rateLimitRequireDistributed,
  supabaseAnonKey,
  supabaseUrl,
  upstashConfig,
  upstashConfigProblem,
} from "@/lib/env";

/** The two URL variables, named when a present URL is unusable. */
const UPSTASH_URL_NAMES = "UPSTASH_REDIS_REST_URL or KV_REST_API_URL";

const RATE_LIMIT_UNUSABLE =
  "the configured Upstash store is unusable: set " +
  `${UPSTASH_URL_NAMES} to the https:// REST URL. Rate limiting is degraded ` +
  "to the per-instance in-memory store, which is not shared across instances";

const RATE_LIMIT_DEGRADED =
  "no distributed store is configured in production: set " +
  "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and " +
  "KV_REST_API_TOKEN). Rate limiting is degraded to the per-instance in-memory " +
  "store, which is not shared across instances. Set " +
  "RATE_LIMIT_REQUIRE_DISTRIBUTED=true to refuse to start instead.";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Sentry first (plan 06-16). Never throws; see SENTRY above.
  const { initSentryServer } = await import("./sentry.server.config");
  initSentryServer();

  // Node.js branch only (see LOG LINES above).
  const { log } = await import("@/server/log");

  try {
    supabaseUrl();
    supabaseAnonKey();
    // Imported here, on the Node.js branch only, so the edge compilation of
    // this file never pulls the service-role module into its bundle.
    const { assertElevatedConfigured } = await import("@/server/db/elevated");
    assertElevatedConfigured();

    const requireDistributed = rateLimitRequireDistributed();
    const upstash = upstashConfig();
    if (!upstash) {
      if (requireDistributed) throw new MissingEnvError(UPSTASH_ENV_NAMES);
      if (isVercelProduction()) {
        log.error(RATE_LIMIT_DEGRADED, { scope: "RateLimit" });
      }
    } else {
      // REVIEW-05 CR-02: a present pair is not necessarily a usable one. A
      // `rediss://` connection string or a pasted `KV_URL` value is refused
      // here, at boot, instead of surfacing as a throw on the request path.
      // Same availability rule as an absent store: refuse to start only under
      // the explicit opt-in, otherwise log once and serve from the memory
      // store. The message never contains the URL or the token.
      const problem = upstashConfigProblem(upstash);
      if (problem) {
        if (requireDistributed) {
          throw new InvalidEnvError(
            UPSTASH_URL_NAMES,
            "an https:// Upstash REST URL"
          );
        }
        log.error(RATE_LIMIT_UNUSABLE, { scope: "RateLimit", problem });
      }
    }
  } catch (err) {
    if (err instanceof MissingEnvError || err instanceof InvalidEnvError) {
      log.error("refusing to start", { scope: "Config", error: err });
    }
    throw err;
  }
}

/** A canonical UUID, the only request id shape trusted (as in src/server/route.ts). */
const REQUEST_ID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Next's error hook (see SENTRY above): Sentry's `captureRequestError`, in a
 * scope tagged with the request's id when it has a UUID-shaped one.
 */
export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context
) => {
  const header = request.headers["x-request-id"];
  const requestId =
    typeof header === "string" && REQUEST_ID_SHAPE.test(header) ? header : undefined;
  withScope((scope) => {
    if (requestId) scope.setTag("request_id", requestId);
    captureRequestError(error, request, context);
  });
};

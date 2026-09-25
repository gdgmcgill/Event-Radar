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
 */

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
  "[RateLimit] the configured Upstash store is unusable: set " +
  `${UPSTASH_URL_NAMES} to the https:// REST URL. Rate limiting is degraded ` +
  "to the per-instance in-memory store, which is not shared across instances";

const RATE_LIMIT_DEGRADED =
  "[RateLimit] no distributed store is configured in production: set " +
  "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and " +
  "KV_REST_API_TOKEN). Rate limiting is degraded to the per-instance in-memory " +
  "store, which is not shared across instances. Set " +
  "RATE_LIMIT_REQUIRE_DISTRIBUTED=true to refuse to start instead.";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

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
      if (isVercelProduction()) console.error(RATE_LIMIT_DEGRADED);
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
        console.error(`${RATE_LIMIT_UNUSABLE} (${problem})`);
      }
    }
  } catch (err) {
    if (err instanceof MissingEnvError || err instanceof InvalidEnvError) {
      console.error("[Config] refusing to start:", err.message);
    }
    throw err;
  }
}

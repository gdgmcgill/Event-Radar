/**
 * env.ts — validated, lazy configuration readers. This is the config half of
 * REFAC-11 and of finding F-003 (DEC-37).
 *
 * Phase 05-slices-3-5-auth-club-authorization-admin-containment · plan 05-04
 *
 * WHAT IT READS
 *   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, through
 *   `supabaseUrl()` and `supabaseAnonKey()`, and `VERCEL_ENV`, through
 *   `isVercelProduction()`. Plan 05-18 adds the rate-limit store's
 *   configuration: `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` or the
 *   Vercel Marketplace's `KV_REST_API_URL`/`KV_REST_API_TOKEN`, through
 *   `upstashConfig()`, and the optional `RATE_LIMIT_REQUIRE_DISTRIBUTED`,
 *   through `rateLimitRequireDistributed()`. Plan 06-16 adds the optional
 *   `SENTRY_DSN`, through `sentryDsn()` and `sentryDsnProblem()`, and the pure
 *   `usableSentryDsn()` that the browser init applies to the DSN it reads
 *   itself. Plan 06-17 adds the optional `HEALTH_TOKEN`, through
 *   `healthToken()`. Every read is a literal `process.env.NAME` member
 *   access. Nothing is read by computed key: a computed read evades the
 *   service-key lint rule in `eslint.config.mjs`, and Next inlines only literal
 *   `process.env.NEXT_PUBLIC_*` reads into the browser bundle.
 *
 *   This module does NOT read `SUPABASE_SERVICE_ROLE_KEY`. The lint boundary
 *   allows that read only inside `src/lib/supabase/**` and
 *   `src/server/db/elevated/**` (research C9), so the service key's reader,
 *   `serviceRoleKey()`, lives in `src/lib/supabase/service.ts` and wraps its
 *   own literal member access in `requireEnvValue` from here.
 *
 * IT FAILS CLOSED AT FIRST READ
 *   A reader whose variable is absent, empty or whitespace only throws
 *   `MissingEnvError`, and the message names the variable. The caller gets a
 *   named failure at the line that needed the value, not an `undefined` handed
 *   to a Supabase factory that fails later and far from the cause. That silent
 *   `undefined` is what the `!` non-null assertions these readers replace
 *   allowed.
 *
 * WHY NOT AT IMPORT
 *   Nothing here runs at module evaluation, deliberately (research C8):
 *     - CI's `ci` job runs `next build` with placeholder public variables and
 *       NO service key, and `next build` evaluates route modules while it
 *       collects page data. An import-time throw fails the build.
 *     - `src/proxy.test.ts` imports the proxy with no Supabase env set. An
 *       import-time throw fails that PRESERVE suite.
 *   The server still refuses to start without its configuration: the boot
 *   check in `src/instrumentation.ts` calls these readers once per server
 *   start, outside the build phase.
 *
 * WHY PRODUCTION IS VERCEL_ENV
 *   The Playwright harness runs `next build && next start`, so `NODE_ENV` is
 *   `"production"` on a developer machine and in CI. Keying anything on
 *   `NODE_ENV` would treat the local harness as the production deployment.
 *   Only Vercel sets `VERCEL_ENV === "production"`, and only on the
 *   production deployment.
 */

/** Thrown at first read when a required environment variable is absent or blank. */
export class MissingEnvError extends Error {
  constructor(name: string) {
    super(`Missing required environment variable: ${name}`);
    this.name = "MissingEnvError";
  }
}

/**
 * Validate one environment value that the caller has already read with a
 * literal `process.env.NAME` member access.
 *
 * @param name - the variable's name, used only in the error message
 * @param value - the value the caller read
 * @returns the value, unchanged
 * @throws MissingEnvError when the value is undefined, empty or whitespace only
 */
export function requireEnvValue(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new MissingEnvError(name);
  }
  return value;
}

/** The Supabase project URL. Throws MissingEnvError when unset or blank. */
export function supabaseUrl(): string {
  return requireEnvValue(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}

/** The Supabase anon (publishable) key. Throws MissingEnvError when unset or blank. */
export function supabaseAnonKey(): string {
  return requireEnvValue(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** True only on Vercel's production deployment. `NODE_ENV` is never consulted. */
export function isVercelProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/** Thrown at first read when an optional variable is set to a value it cannot mean. */
export class InvalidEnvError extends Error {
  constructor(name: string, expected: string) {
    super(`Invalid environment variable: ${name} (expected ${expected})`);
    this.name = "InvalidEnvError";
  }
}

// ─── The rate-limit store (plan 05-18, DEC-50, DEC-59 Part 2) ────────────────

/** Both accepted name pairs, as they appear in every message about them. */
export const UPSTASH_ENV_NAMES =
  "UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN";

/** One complete Upstash REST endpoint and its token. */
export type UpstashConfig = { url: string; token: string };

function present(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== "";
}

/**
 * The distributed rate-limit store's configuration, or null.
 *
 * Reads `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` first and falls
 * back to `KV_REST_API_URL`/`KV_REST_API_TOKEN`, the names the Vercel
 * Marketplace integration injects (research C13). A pair is used only when
 * both of its halves are present: a URL from one pair is never combined with
 * a token from the other. Blank and whitespace-only values count as absent.
 *
 * It never throws, in production included. DEC-59 Part 2 superseded DEC-50's
 * "required at boot": what an absent store means is decided once, by the boot
 * check in `src/instrumentation.ts` (one logged error, or a refusal to start
 * when `RATE_LIMIT_REQUIRE_DISTRIBUTED` is true). The request path then falls
 * back to the in-memory store.
 *
 * The returned values are TRIMMED (REVIEW-05 CR-02). A value pasted with a
 * trailing space or newline is present, and `@upstash/redis` throws on it
 * synchronously; handing it through untrimmed made the store's construction
 * throw on every request. Whether the trimmed URL is usable is a separate
 * question, answered by `upstashConfigProblem()`.
 */
export function upstashConfig(): UpstashConfig | null {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (present(upstashUrl) && present(upstashToken)) {
    return { url: upstashUrl.trim(), token: upstashToken.trim() };
  }
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (present(kvUrl) && present(kvToken)) {
    return { url: kvUrl.trim(), token: kvToken.trim() };
  }
  return null;
}

/**
 * The URL shape `@upstash/redis` 1.38.2 accepts in its constructor; anything
 * else makes `new Redis()` throw `UrlError` synchronously
 * (`node_modules/@upstash/redis/nodejs.js`, `HttpClient`).
 */
const UPSTASH_CLIENT_URL = /^https?:\/\/[^\s#$./?].\S*$/;

/**
 * Why this Upstash pair cannot be used, or null when it can (REVIEW-05 CR-02).
 *
 * The URL must parse, use `https:` (the REST endpoint; the token travels in
 * a header), and match the shape the Upstash client accepts. The common
 * mistakes this catches: a `rediss://` TCP URL, or the Marketplace's
 * `KV_URL` value, pasted where the REST URL belongs.
 *
 * The message NEVER contains the URL or the token. A `rediss://` URL carries
 * the database password in its userinfo, so only the scheme is named.
 */
export function upstashConfigProblem(config: UpstashConfig): string | null {
  let parsed: URL;
  try {
    parsed = new URL(config.url);
  } catch {
    return "the Upstash REST URL does not parse as a URL";
  }
  if (parsed.protocol !== "https:") {
    return `the Upstash REST URL must use https: (got ${parsed.protocol}); use the REST URL, not the redis:// or rediss:// connection string`;
  }
  if (!UPSTASH_CLIENT_URL.test(config.url)) {
    return "the Upstash REST URL is not in the form the Upstash client accepts";
  }
  return null;
}

/**
 * `RATE_LIMIT_REQUIRE_DISTRIBUTED`, optional (DEC-59 Part 2). True makes a
 * missing store a boot failure, restoring DEC-50's fail-closed boot by opt-in.
 * Unset or blank is false. "true"/"false" are read case-insensitively; any
 * other value throws `InvalidEnvError`, so a typo cannot silently switch the
 * enforcement off.
 */
export function rateLimitRequireDistributed(): boolean {
  const value = process.env.RATE_LIMIT_REQUIRE_DISTRIBUTED;
  if (!present(value)) return false;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new InvalidEnvError(
    "RATE_LIMIT_REQUIRE_DISTRIBUTED",
    '"true" or "false"'
  );
}

// ─── Sentry (plan 06-16, DEC-76) ─────────────────────────────────────────────

/**
 * The value, trimmed, when it is a Sentry DSN this app will use, else null.
 *
 * A usable DSN parses as a URL, uses `https:`, carries the public key as its
 * username and a project id as its path: `https://<key>@<host>/<project>`.
 * Anything else reads as absent, which disables Sentry. It never throws.
 * Pure: it reads nothing, so the browser init can apply it to the
 * `NEXT_PUBLIC_SENTRY_DSN` it reads with its own literal member access.
 */
export function usableSentryDsn(value: string | undefined): string | null {
  if (!present(value)) return null;
  const trimmed = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (parsed.username === "") return null;
  if (parsed.pathname.replace(/\//g, "") === "") return null;
  return trimmed;
}

/**
 * `SENTRY_DSN`, optional (DEC-76): the server's DSN, or null when it is
 * absent, blank or not an https Sentry DSN. Absent means disabled; it never
 * throws, so a missing or mistyped DSN can never fail boot.
 */
export function sentryDsn(): string | null {
  return usableSentryDsn(process.env.SENTRY_DSN);
}

/**
 * Why `sentryDsn()` is null, or null when it is not. The text names the
 * variable and never its value: a DSN carries the project's public key.
 */
export function sentryDsnProblem(): string | null {
  const value = process.env.SENTRY_DSN;
  if (!present(value)) return "SENTRY_DSN is not set";
  if (usableSentryDsn(value) === null) return "SENTRY_DSN is not an https Sentry DSN";
  return null;
}

// ─── The uptime monitor's token (plan 06-17, DEC-78) ─────────────────────────

/** The shortest `HEALTH_TOKEN` that enables token access to /api/health. */
export const HEALTH_TOKEN_MIN_LENGTH = 32;

let shortHealthTokenWarned = false;

/**
 * `HEALTH_TOKEN`, optional (DEC-78): the bearer an uptime monitor presents to
 * read the /api/health report, trimmed, or null.
 *
 * Absent or blank is null: the token arm is DISABLED, never compared against
 * an empty or undefined value (the F-001/F-002 lesson). A value shorter than
 * `HEALTH_TOKEN_MIN_LENGTH` is also null, with ONE warn line per process that
 * names the variable and the minimum and never the value. It never throws, so
 * a bad token can never fail boot or a request.
 *
 * The warn line goes to `console.warn` in the logger's JSON shape: this module
 * is shared with browser code and cannot import the Node-only logger.
 */
export function healthToken(): string | null {
  const value = process.env.HEALTH_TOKEN;
  if (!present(value)) return null;
  const trimmed = value.trim();
  if (trimmed.length < HEALTH_TOKEN_MIN_LENGTH) {
    if (!shortHealthTokenWarned) {
      shortHealthTokenWarned = true;
      console.warn(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "warn",
          msg: `HEALTH_TOKEN is shorter than ${HEALTH_TOKEN_MIN_LENGTH} characters; token access to /api/health is disabled`,
          scope: "Health",
        })
      );
    }
    return null;
  }
  return trimmed;
}

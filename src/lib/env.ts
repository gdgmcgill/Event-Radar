/**
 * env.ts — validated, lazy configuration readers. This is the config half of
 * REFAC-11 and of finding F-003 (DEC-37).
 *
 * Phase 05-slices-3-5-auth-club-authorization-admin-containment · plan 05-04
 *
 * WHAT IT READS
 *   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, through
 *   `supabaseUrl()` and `supabaseAnonKey()`, and `VERCEL_ENV`, through
 *   `isVercelProduction()`. Every read is a literal `process.env.NAME` member
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

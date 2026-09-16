/**
 * envOverride.ts — the SUPABASE_* override is all-or-nothing, in one place.
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · 03-REVIEW.md WR-04
 *
 * WHAT WENT WRONG WITHOUT THIS
 *   Both `e2e/env.ts` and `scripts/seed/load.ts` accepted the explicit
 *   SUPABASE_* trio when all of it was present, and otherwise fell through to
 *   `supabase status -o env` — per field. So the fall-through read
 *
 *       url: fromEnv.url ?? read("API_URL")
 *
 *   and exporting SUPABASE_URL *alone* produced one object assembled from two
 *   different environments: a remote URL carrying local-stack keys. The seed
 *   guard refuses a remote URL today, so the failure is loud; the moment a
 *   staging target is acknowledged (SEED_STAGING_PROJECT_REF) it stops being
 *   loud and becomes a seed WRITE against a remote project with keys that
 *   belong to somebody's laptop.
 *
 *   A partial override is never a thing anyone meant. It is a half-finished
 *   export, and the only correct response to it is to stop.
 *
 * THE RULE, STATED ONCE
 *   If none of the three names is set, there is no override and the caller
 *   reads the running local stack. If all three are set, that is the override.
 *   Anything in between throws — before any client exists, before any target is
 *   resolved, and naming which of the three are missing.
 *
 *   The trio is treated as one unit even by `scripts/seed/load.ts`, which only
 *   consumes two of the three. A loader that quietly tolerated a stray
 *   SUPABASE_ANON_KEY would be re-opening the same door one name narrower.
 *
 * ZERO DEPENDENCIES, NO SIDE EFFECTS, NOTHING PRINTED. This module is imported
 * by a unit suite (`src/__tests__/seed/env-override.test.ts`); it must stay
 * importable without starting, reading or writing anything, and it must never
 * put a key in an error message.
 */

/** The three names, in the order the error message lists them. */
export const SUPABASE_OVERRIDE_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export interface SupabaseOverride {
  readonly url: string;
  readonly anonKey: string;
  readonly serviceRoleKey: string;
}

/** A value counts as absent when it is unset OR empty — `export FOO=` is not an override. */
function present(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Returns the complete override, or `null` when none of the three names is set.
 *
 * Throws when some but not all are set. The message names the missing keys and
 * never echoes a value — the names are safe to print, the values are not.
 */
export function readSupabaseOverride(
  env: Record<string, string | undefined> = process.env
): SupabaseOverride | null {
  const set = SUPABASE_OVERRIDE_KEYS.filter((k) => present(env[k]));
  if (set.length === 0) return null;

  if (set.length !== SUPABASE_OVERRIDE_KEYS.length) {
    const missing = SUPABASE_OVERRIDE_KEYS.filter((k) => !present(env[k]));
    throw new Error(
      "REFUSED: a PARTIAL SUPABASE_* override was found. " +
        `Set: ${set.join(", ")}. Missing: ${missing.join(", ")}. ` +
        "Export all three or none — a partial override mixes one environment's " +
        "URL with another environment's keys, which is how a local key ends up " +
        "pointed at a remote project. (03-REVIEW.md WR-04.)"
    );
  }

  return {
    url: env.SUPABASE_URL as string,
    anonKey: env.SUPABASE_ANON_KEY as string,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY as string,
  };
}

/**
 * env.ts — where the harness gets its Supabase credentials, and where it does not.
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
 *
 * `.env.local` describes PRODUCTION. Reading it here would point the dev server
 * and ten persona sign-ins at the live project, which is precisely the accident
 * `scripts/seed/guard.ts` exists to make impossible — so this module does not
 * read it, and the guard is applied to whatever this module returns.
 *
 * The values come from `supabase status -o env` at run time, or from the
 * explicit SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY trio
 * when all three are exported. Ambient NEXT_PUBLIC_* values are never used.
 * Nothing is printed and nothing is written to disk.
 */

import { execFileSync } from "node:child_process";

import { readSupabaseOverride } from "../scripts/seed/envOverride";

export interface LocalStack {
  readonly url: string;
  readonly anonKey: string;
  readonly serviceRoleKey: string;
}

let cached: LocalStack | null = null;

export function localStackEnv(): LocalStack {
  if (cached) return cached;

  // Only the explicit SUPABASE_* trio can override the running stack, and only
  // when all three are present. NEXT_PUBLIC_* is deliberately NOT consulted:
  // it is ambient (CI exports a placeholder to every job, Next loads it from
  // .env.local) and describes whatever the app was built against, which is
  // never the harness's business. Letting it in is how the CI e2e job pointed
  // itself at "https://placeholder.supabase.co" and was refused by the guard
  // (03-08 evidence/ci-e2e-red.txt, deferred item DI-32).
  //
  // ALL THREE OR NONE. `readSupabaseOverride` throws on a partial trio rather
  // than letting it fall through field-by-field into the block below, which is
  // what used to assemble `{url: <remote>, anonKey: <local>, serviceRoleKey:
  // <local>}` out of a single stray `export SUPABASE_URL=...` (03-REVIEW.md
  // WR-04). The throw happens before any client, any target check and any
  // browser exists.
  const fromEnv = readSupabaseOverride();
  if (fromEnv) {
    cached = fromEnv;
    return cached;
  }

  let status: string;
  try {
    status = execFileSync("supabase", ["status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error(
      "The persona harness needs the LOCAL Supabase stack. Start it with " +
        "`supabase start`, or export SUPABASE_URL, SUPABASE_ANON_KEY and " +
        "SUPABASE_SERVICE_ROLE_KEY. `.env.local` is deliberately not read here."
    );
  }

  const read = (name: string): string =>
    status.match(new RegExp(`^${name}="?([^"\\n]*)"?$`, "m"))?.[1] ?? "";

  // No `?? fromEnv.x` fallbacks here, deliberately: `fromEnv` is null on this
  // path by construction, so every one of these three values comes from the one
  // running local stack. Mixing sources is the defect WR-04 named.
  cached = {
    url: read("API_URL"),
    anonKey: read("ANON_KEY"),
    serviceRoleKey: read("SERVICE_ROLE_KEY"),
  };
  return cached;
}

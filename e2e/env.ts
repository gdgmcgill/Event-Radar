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
  const fromEnv = {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  if (fromEnv.url && fromEnv.anonKey && fromEnv.serviceRoleKey) {
    cached = {
      url: fromEnv.url,
      anonKey: fromEnv.anonKey,
      serviceRoleKey: fromEnv.serviceRoleKey,
    };
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

  cached = {
    url: fromEnv.url ?? read("API_URL"),
    anonKey: fromEnv.anonKey ?? read("ANON_KEY"),
    serviceRoleKey: fromEnv.serviceRoleKey ?? read("SERVICE_ROLE_KEY"),
  };
  return cached;
}

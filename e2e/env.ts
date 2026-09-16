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
 * environment when CI has already exported them. Nothing is printed and nothing
 * is written to disk.
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

  const fromEnv = {
    url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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

import { createClient } from "@supabase/supabase-js";
import { requireEnvValue, supabaseUrl } from "@/lib/env";
import type { Database } from "./types";

/**
 * The service-role key, validated at first read (DEC-37, F-003).
 *
 * This is the only read of `SUPABASE_SERVICE_ROLE_KEY` in production source.
 * It stays here, a literal member access inside `src/lib/supabase/`, because
 * the lint boundary in `eslint.config.mjs` refuses the read anywhere else
 * (research C9). Throws MissingEnvError naming the variable when it is absent
 * or blank. Never read at module evaluation.
 */
export function serviceRoleKey(): string {
  return requireEnvValue(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Supabase client using the service role key.
 * Bypasses RLS — use only in trusted server-side contexts
 * (admin routes, cron jobs).
 */
export function createServiceClient() {
  return createClient<Database>(supabaseUrl(), serviceRoleKey());
}

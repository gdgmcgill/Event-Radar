import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Supabase client using the service role key.
 * Bypasses RLS — use only in trusted server-side contexts
 * (admin routes, cron jobs).
 */
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

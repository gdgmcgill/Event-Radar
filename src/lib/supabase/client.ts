/**
 * Supabase browser client
 * Use this in client components and React hooks
 *
 * The two reads stay literal `process.env.NEXT_PUBLIC_*` member accesses so
 * Next inlines them into the browser bundle; each is wrapped in
 * `requireEnvValue`, which throws MissingEnvError naming the variable when it
 * is absent or blank (DEC-37, F-003).
 */

import { createBrowserClient } from "@supabase/ssr";
import { requireEnvValue } from "@/lib/env";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    requireEnvValue(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
    requireEnvValue(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  );
}

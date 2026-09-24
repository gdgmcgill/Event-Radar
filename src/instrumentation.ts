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
 * The Upstash arm of this check is added by 05-18 (DEC-50).
 */

import { MissingEnvError, supabaseAnonKey, supabaseUrl } from "@/lib/env";

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
  } catch (err) {
    if (err instanceof MissingEnvError) {
      console.error("[Config] refusing to start:", err.message);
    }
    throw err;
  }
}

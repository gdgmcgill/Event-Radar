/**
 * The single sanctioned door to the service-role client.
 *
 * Bypasses RLS — use only in trusted server-side contexts (admin routes, cron
 * jobs). That warning is carried forward verbatim from the module this wraps,
 * because wrapping a credential does not make it less dangerous; it only makes
 * its use countable.
 *
 * This module WRAPS `@/lib/supabase/service`. It does not re-implement the
 * client construction, and the seam does not become a fourth Supabase client
 * factory. It is the only module outside `src/lib/supabase/` permitted to
 * import the service factory, and an ESLint boundary rule enforces that for
 * everything under `src/app/**`.
 *
 * Every elevated operation added in a later phase gets a row in REGISTRY.md
 * stating why RLS cannot express it. The register is empty in this phase.
 */

import { createServiceClient } from "@/lib/supabase/service";

/**
 * Returns a Supabase client authenticated with the service role key.
 *
 * DANGEROUS BY DESIGN: the returned client bypasses every row-level security
 * policy. Reach for it only when the operation genuinely cannot be expressed
 * as a policy, and record that reason in REGISTRY.md.
 *
 * A client is constructed per call. There is deliberately no module-level
 * singleton: a long-lived elevated client is a longer-lived blast radius, and
 * the factory is cheap.
 */
export function getElevatedClient(): ReturnType<typeof createServiceClient> {
  return createServiceClient();
}

/**
 * The per-request context — one call per request produces the client, the
 * authenticated user, the profile slice every guard needs, and a request id.
 *
 * This is `src/lib/admin.ts` widened. That file is already the correct shape:
 * it reads the REVALIDATING user accessor rather than a session, it reads the
 * profile, and it returns a bare object instead of throwing. The only changes
 * here are the width of the profile selection and the addition of a request id.
 *
 * It is NOT a fourth Supabase client factory. The client comes from awaiting
 * the existing server factory in `@/lib/supabase/server`.
 *
 * Route handlers call `createRequestContext()` once at the top and thread the
 * context down. "Computed once per request" is therefore a property of the call
 * site, not of a framework internal whose scoping inside Route Handlers this
 * program deliberately did not make load-bearing.
 */

import * as ReactNamespace from "react";
import type { User as AuthUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

/** The client the existing server factory produces. Derived rather than
 * restated, so the seam cannot drift from the factory it wraps. */
export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The profile slice read once per request.
 *
 * These three columns are the row's key (`id`), what the role guard reads
 * (`roles`, in `requireRole`) and what the onboarding guard will read
 * (`onboarding_completed`). `requireClubRole` reads no profile column — it
 * reads `club_members`. Reading the slice once is the whole point of a
 * per-request context.
 *
 * THE SEAM PERFORMS NO BAN CHECK. `requireUser`, `requireRole` and
 * `requireClubRole` establish authentication and role membership only; a
 * handler that adopts them gets no ban enforcement from them. Ban enforcement
 * today is:
 *   - the proxy ring (`src/proxy.ts`), which reads the caller's ban columns on
 *     every matched request but FAILS OPEN: the whole ring is skipped when its
 *     environment is unbound (F-003), its outer catch passes the request
 *     through on any error, and a failed ban read counts as "not banned". It
 *     also answers a JSON API call with a redirect to an HTML page (F-062);
 *   - `checkBanStatus()` (`src/lib/ban.ts`), called by individual write
 *     handlers — among them save POST and rsvp POST, but not their DELETE
 *     arms, an asymmetry the characterization suites pin.
 *
 * A seam ban guard that fails closed is REFAC-11, Phase 5. It will re-add
 * `banned_at` and `ban_expires_at` to this slice knowingly, alongside the guard
 * that reads them (DEC-24). Until then, selecting them here would only imply a
 * check nobody performs (DI-35).
 */
export type RequestProfile = Pick<
  Tables<"users">,
  "id" | "roles" | "onboarding_completed"
>;

export type RequestContext = {
  supabase: ServerSupabaseClient;
  user: AuthUser | null;
  profile: RequestProfile | null;
  requestId: string;
};

const PROFILE_COLUMNS =
  "id, roles, onboarding_completed";

/**
 * Builds the request context.
 *
 * An anonymous request never reaches the profile table: there is no id to scope
 * the read to, and issuing an unscoped read would be worse than issuing none.
 */
export async function createRequestContext(): Promise<RequestContext> {
  const supabase = await createClient();
  const requestId = crypto.randomUUID();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null, requestId };
  }

  const { data: profile } = await supabase
    .from("users")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .single();

  return { supabase, user, profile: profile ?? null, requestId };
}

type RenderPassMemo = <T extends () => unknown>(fn: T) => T;

/**
 * React's `cache` memoizes per RENDER PASS, and is exported from `react` only
 * under the `react-server` condition.
 *
 * DEVIATION, recorded rather than hidden: React is pinned to 18.3.x for this
 * program and React 19 is explicitly out of scope. React 18.3.1 exports `cache`
 * from NEITHER build — not `index.js` and not `react.shared-subset.js` — and
 * `@types/react` 18.3 declares it only in `canary.d.ts`, which this project
 * does not reference. So the alias is resolved by capability rather than by a
 * static import that would fail to type-check and would be `undefined` at
 * runtime.
 *
 * The fallback is the un-memoized function, which is CORRECT and merely
 * re-reads the user — never a module-level cache, which would be scoped to the
 * process rather than the request and would leak one user's profile into
 * another user's response. When React gains `cache`, this memoizes with no
 * further change.
 */
const memoizePerRenderPass: RenderPassMemo = (() => {
  const maybeCache: unknown = (ReactNamespace as Record<string, unknown>).cache;
  return typeof maybeCache === "function"
    ? (maybeCache as RenderPassMemo)
    : (fn) => fn;
})();

/**
 * Server Component / page entry point. Route handlers must NOT depend on this —
 * they call `createRequestContext()` explicitly and thread the context down.
 */
export const getRequestContext = memoizePerRenderPass(createRequestContext);

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
 * These five columns are the row's key (`id`), what the role guard reads
 * (`roles`, in `requireRole`), what the onboarding guard reads
 * (`onboarding_completed`, in `requireOnboarded`) and what the ban guard reads
 * (`banned_at` and `ban_expires_at`, in `requireActiveUser`). `requireClubRole`
 * reads no profile column. It reads `club_members`. Reading the slice once is
 * the whole point of a per-request context: one query serves every guard.
 *
 * THE BAN AND ONBOARDING GUARDS NOW EXIST (plan 05-04, DEC-34, DEC-35).
 * `requireActiveUser` refuses an anonymous caller (401), a signed-in caller
 * with no profile row (403 "Profile not found") and a suspended caller (403
 * "Account suspended"). `requireOnboarded` refuses a signed-in caller who has
 * not finished onboarding (403 "Onboarding required"). Both read this slice
 * and issue no query of their own. The ban columns come back into the slice
 * together with the guard that reads them, as DEC-24 required, and that closes
 * DI-35: the slice no longer implies a check nobody performs.
 *
 * Adopting the guards is the handlers' job, and this plan adopts none of them.
 * Until 05-06 and 05-07 move each write arm onto them, ban enforcement at a
 * handler is still the legacy helper `checkBanStatus()` in `src/lib/ban.ts`
 * (save POST, rsvp POST and the other callers the 05-03 net pins), plus the
 * proxy ring, which 05-05 makes fail closed (F-003, F-062).
 */
export type RequestProfile = Pick<
  Tables<"users">,
  "id" | "roles" | "onboarding_completed" | "banned_at" | "ban_expires_at"
>;

export type RequestContext = {
  supabase: ServerSupabaseClient;
  user: AuthUser | null;
  profile: RequestProfile | null;
  requestId: string;
};

const PROFILE_COLUMNS =
  "id, roles, onboarding_completed, banned_at, ban_expires_at";

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

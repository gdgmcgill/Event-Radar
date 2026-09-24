/**
 * The active-user guard: authenticated, has a profile row, and is not banned
 * (DEC-34, DEC-35).
 *
 * THE WRITE-GUARD CONTRACT (DEC-34)
 *   Every state-changing, non-admin, authenticated arm under `src/app/api`
 *   calls, as its first statements after `createRequestContext()` and before
 *   any read or write:
 *     1. `requireActiveUser(ctx)`, which is this guard, and then
 *     2. `requireOnboarded(ctx)`.
 *   The two onboarding exemptions (`POST /api/onboarding/complete` and the
 *   self-update `PATCH /api/users/[id]`) skip step 2 AT THE CALL SITE. They
 *   still call this guard. Neither exemption lives in a guard, so no guard
 *   can be tricked into granting it. The anonymous-tolerant writers
 *   (`POST /api/interactions`, `POST /api/feedback`) call both guards only
 *   when `ctx.user` is present.
 *
 * THE ARMS, IN ORDER
 *   - no user            → 401 {"error":"Unauthorized"}          (requireUser's bytes)
 *   - no profile row     → 403 {"error":"Profile not found"}     (DEC-35)
 *   - banned (isBanned)  → 403 {"error":"Account suspended"}     (the legacy helper's bytes)
 *   - otherwise          → the permit arm, carrying the user
 *
 *   A missing profile row is DENIED. The legacy helper in `src/lib/ban.ts`
 *   reads a null profile as "not banned" and admits the caller, which is the
 *   fail-open shape F-088 registers. Absence of a row is not evidence of good
 *   standing.
 *
 * ONE READ, NOT TWO
 *   The guard reads `ctx.profile`, the single `users` read the request context
 *   already made, widened to carry `banned_at` and `ban_expires_at`. It issues
 *   no query of its own. The 05-03 DEFECT net pins exactly one `users` select
 *   per guarded arm.
 *
 * `isBanned` from `src/lib/ban.ts` is the one ban predicate. It is not
 * re-implemented here.
 */

import { isBanned } from "@/lib/ban";
import type { RequestContext } from "../context";
import { forbidden } from "../errors";
import { requireUser, type AuthGuardResult } from "./requireUser";

/**
 * @param ctx - The request context, carrying the user and the profile slice
 *              (including the two ban columns).
 * @returns The permit arm carrying the authenticated user, or the deny arm
 *          carrying a ready-to-return 401 (not authenticated) or 403 (no
 *          profile row, or suspended).
 */
export function requireActiveUser(
  ctx: Pick<RequestContext, "user" | "profile">
): AuthGuardResult {
  const authenticated = requireUser(ctx);
  if (!authenticated.ok) {
    return authenticated;
  }

  // Fail closed: a signed-in user with no profile row is refused, not admitted
  // as "not banned" (DEC-35).
  if (!ctx.profile) {
    return { ok: false, response: forbidden("Profile not found") };
  }

  if (isBanned(ctx.profile)) {
    return { ok: false, response: forbidden("Account suspended") };
  }

  return authenticated;
}

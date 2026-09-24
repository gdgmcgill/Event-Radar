/**
 * The onboarding guard: a signed-in caller must have finished onboarding
 * before acting (DEC-34, DEC-35).
 *
 * THE WRITE-GUARD CONTRACT (DEC-34)
 *   Handlers call `requireActiveUser(ctx)` first and this guard second, both
 *   before any read or write. That order is why this guard does not handle
 *   authentication: an anonymous caller gets `{ ok: true }` here and is refused
 *   by `requireActiveUser` (research C2). A guard that also answered 401 would
 *   make the two guards' responsibilities overlap, and the order would stop
 *   mattering in ways nobody tests.
 *
 *   Exactly two arms do not call this guard, and the exemption is written at
 *   those call sites, not in the guard:
 *     - `POST /api/onboarding/complete`, the step that completes onboarding;
 *     - `PATCH /api/users/[id]`, the self-update the onboarding wizard uses
 *       (that route already refuses another user's id).
 *   Calling this guard on either one would lock every new user out of the
 *   wizard.
 *
 * THE ARMS
 *   - no user                         → { ok: true } (not this guard's question)
 *   - no profile row                  → 403 {"error":"Profile not found"} (DEC-35)
 *   - onboarding_completed !== true   → 403 {"error":"Onboarding required"}
 *   - otherwise                       → { ok: true }
 *
 *   Only `true` admits. `false` and `null` (a row written before the column
 *   had a default) are both refused. Fail closed.
 *
 *   The value comes from the database row the request context read, never
 *   from the `needs_onboarding` cookie, which is a hint the callback sets and
 *   that nothing trusts.
 */

import type { NextResponse } from "next/server";
import type { RequestContext } from "../context";
import { forbidden } from "../errors";

export type OnboardingGuardResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

/**
 * @param ctx - The request context, carrying the user and the profile slice.
 * @returns `{ ok: true }` when the caller is anonymous or onboarded, or the
 *          deny arm carrying a ready-to-return 403.
 */
export function requireOnboarded(
  ctx: Pick<RequestContext, "user" | "profile">
): OnboardingGuardResult {
  if (!ctx.user) {
    return { ok: true };
  }

  if (!ctx.profile) {
    return { ok: false, response: forbidden("Profile not found") };
  }

  if (ctx.profile.onboarding_completed !== true) {
    return { ok: false, response: forbidden("Onboarding required") };
  }

  return { ok: true };
}

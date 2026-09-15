/**
 * The site-wide role guard.
 *
 * 401 and 403 are kept distinct on purpose: an anonymous caller is not
 * authenticated, a caller without the role is authenticated but not permitted.
 * Collapsing the two hides which one happened.
 *
 * The membership predicate is delegated to `src/lib/roles.ts` rather than
 * re-implemented here — that file is the one authority on what carrying a role
 * means in this tree.
 */

import { hasRole } from "@/lib/roles";
import type { UserRole } from "@/types";
import type { RequestContext } from "../context";
import { forbidden } from "../errors";
import { requireUser, type AuthGuardResult } from "./requireUser";

/** The exact parameter `hasRole` reads — it touches `roles` and nothing else. */
type RoleBearer = Parameters<typeof hasRole>[0];

/**
 * @param ctx     - The request context, carrying the user and the profile slice.
 * @param role    - The role the caller must hold.
 * @param message - The 403 body, when the caller can say something better than
 *                  the generic default.
 * @returns The permit arm carrying the authenticated user, or the deny arm
 *          carrying a ready-to-return 401 (not authenticated) or 403 (not
 *          permitted).
 */
export function requireRole(
  ctx: Pick<RequestContext, "user" | "profile">,
  role: UserRole,
  message = "Forbidden"
): AuthGuardResult {
  const authenticated = requireUser(ctx);
  if (!authenticated.ok) {
    return authenticated;
  }

  // No profile row means no roles can be established. Fail closed: absence of
  // evidence is not evidence of entitlement.
  if (!ctx.profile) {
    return { ok: false, response: forbidden(message) };
  }

  // `hasRole` reads exactly one property. The bearer is narrowed to that
  // property rather than fabricating the profile fields it never touches.
  const bearer = { roles: ctx.profile.roles ?? [] } as RoleBearer;

  if (!hasRole(bearer, role)) {
    return { ok: false, response: forbidden(message) };
  }

  return authenticated;
}

/**
 * The admin page gate for server layouts (plan 06-17, DEC-79, F-054, DI-55).
 *
 * The route-handler guards (`requireActiveUser`, `requireRole`) return a
 * ready-to-return JSON 401/403. A layout cannot answer JSON, so this is their
 * page-shaped composition: every refusal is `redirect(redirectTo)`.
 *
 * THE ARMS
 *   - no user                          → redirect(redirectTo)
 *   - no profile row                   → redirect(redirectTo)  (fail closed, DEC-35)
 *   - banned (isBanned), admin or not  → redirect(redirectTo)  (DI-55)
 *   - signed in without the admin role → redirect(redirectTo)
 *   - otherwise                        → the request context, for the layout to reuse
 *
 * Each caller passes the target it already had (DEC-44): the admin layout
 * "/", the moderation layout "/" after its own anonymous redirect to
 * "/admin-login", and the /docs and /health layouts "/".
 *
 * The decision reads `getRequestContext()`, the render-pass-memoized request
 * context, so a layout and its page share one user read and one profile read.
 * `isBanned` from `src/lib/ban.ts` and `hasRole` from `src/lib/roles.ts` are the
 * one ban predicate and the one role predicate; neither is re-implemented.
 * `requireRole` keeps no ban responsibility (DEC-58).
 */

import { redirect } from "next/navigation";
import { isBanned } from "@/lib/ban";
import { hasRole } from "@/lib/roles";
import {
  getRequestContext,
  type RequestContext,
  type RequestProfile,
} from "../context";

/** The context of an active admin: the user and the profile row are present. */
export type AdminPageContext = RequestContext & {
  user: NonNullable<RequestContext["user"]>;
  profile: RequestProfile;
};

/** The exact parameter `hasRole` reads: it touches `roles` and nothing else. */
type RoleBearer = Parameters<typeof hasRole>[0];

/**
 * @param redirectTo - Where a refused caller is sent.
 * @returns The request context of an active admin. Never returns otherwise:
 *          `redirect` throws.
 */
export async function requireAdminPage(
  redirectTo: string
): Promise<AdminPageContext> {
  const ctx = await getRequestContext();

  if (!ctx.user || !ctx.profile) redirect(redirectTo);

  if (isBanned(ctx.profile)) redirect(redirectTo);

  const bearer = { roles: ctx.profile.roles ?? [] } as RoleBearer;
  if (!hasRole(bearer, "admin")) redirect(redirectTo);

  return { ...ctx, user: ctx.user, profile: ctx.profile };
}

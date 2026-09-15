/**
 * The authentication guard.
 *
 * Returns a discriminated result rather than throwing, so a handler adopting
 * the seam keeps its existing control flow: check `ok`, return `response`.
 *
 * The guard fails CLOSED by construction. The deny arm is not a branch taken
 * on a recognized failure — it is what every path that is not explicitly
 * permitted produces.
 */

import type { NextResponse } from "next/server";
import type { User as AuthUser } from "@supabase/supabase-js";
import type { RequestContext } from "../context";
import { unauthorized } from "../errors";

export type AuthGuardResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: NextResponse };

/**
 * @param ctx - The request context. Only `user` is read; the context has
 *              already done the revalidating read.
 * @returns The permit arm carrying the authenticated user, or the deny arm
 *          carrying a ready-to-return 401.
 */
export function requireUser(
  ctx: Pick<RequestContext, "user">
): AuthGuardResult {
  if (!ctx.user) {
    return { ok: false, response: unauthorized() };
  }

  return { ok: true, user: ctx.user };
}

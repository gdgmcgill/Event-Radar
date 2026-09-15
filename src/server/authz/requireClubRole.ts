/**
 * The club-membership guard (D-09).
 *
 * This generalizes the shape at src/app/api/clubs/[id]/route.ts DELETE:
 * select the membership row, then compare the role. Two things are
 * generalized and one thing is deliberately NOT added.
 *
 * Generalized: the guard takes a SET of acceptable roles rather than
 * hard-coding one, and it reports the caller's ACTUAL role — on the permit arm
 * so a handler can branch on it, and on the deny arm so a handler can say
 * something useful.
 *
 * Deliberately absent: any bypass for a site-wide privileged role. The audit's
 * persona rule R9 records that club membership is the only authority over club
 * operations anywhere in this tree, and the DELETE handler this generalizes
 * says so by having no such branch. Adding one here would be both a behaviour
 * change (L1) and a privilege escalation.
 *
 * This guard reads `club_members` and no other table. That is the mechanical
 * reason it cannot be bypassed: it never learns anything else about the caller.
 */

import type { NextResponse } from "next/server";
import type { Tables } from "@/lib/supabase/types";
import type { ServerSupabaseClient } from "../context";
import { forbidden } from "../errors";

/** The membership role, as the schema declares it. */
export type ClubRole = Tables<"club_members">["role"];

export type ClubRoleGuardResult =
  | { ok: true; role: ClubRole }
  | { ok: false; response: NextResponse; actualRole: ClubRole | null };

/**
 * @param supabase      - The request-scoped client from the context.
 * @param clubId        - The club being operated on.
 * @param userId        - The authenticated caller. Callers must obtain this
 *                        from `requireUser`, never from the request body.
 * @param acceptedRoles - The roles permitted for this operation. An empty set
 *                        permits nobody, which is the correct reading of "no
 *                        role is acceptable".
 * @param message       - The 403 body.
 */
export async function requireClubRole(
  supabase: ServerSupabaseClient,
  clubId: string,
  userId: string,
  acceptedRoles: readonly ClubRole[],
  message = "Forbidden"
): Promise<ClubRoleGuardResult> {
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();

  // No membership row: the caller is not a member of this club. Nothing else
  // about the caller is consulted, and nothing else could change the outcome.
  if (!membership) {
    return { ok: false, response: forbidden(message), actualRole: null };
  }

  if (!acceptedRoles.includes(membership.role)) {
    return {
      ok: false,
      response: forbidden(message),
      actualRole: membership.role,
    };
  }

  return { ok: true, role: membership.role };
}

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
 *
 * The role vocabulary is closed (research C1, DEC-40): the schema's
 * `club_members_role_check` admits only `owner` and `organizer`, so
 * `CLUB_ROLES` lists exactly those two and `ClubRole` is derived from it. A
 * stored value outside that set (a constraint dropped, a row written by hand)
 * is a DENY that reports the value, never a permit: `isClubRole` narrows the
 * row before the accepted-set comparison. Each call site passes exactly the
 * set it accepted before this guard existed, `["owner"]` or `CLUB_ROLES`, and
 * its own 403 message, so the deny bytes do not move (DEC-40). The guard's
 * result carries the role and nothing else; a caller that needs the membership
 * row's id filters by `(club_id, user_id)` instead (the ownership transfer).
 */

import type { NextResponse } from "next/server";
import type { ServerSupabaseClient } from "../context";
import { forbidden } from "../errors";

/**
 * Every role `club_members.role` admits (`club_members_role_check`,
 * `supabase/migrations/20260915214553_baseline.sql`). The generated row type
 * says `string`, so the closed set lives here.
 */
export const CLUB_ROLES = ["owner", "organizer"] as const;

/** The membership role, narrowed to the values the schema admits. */
export type ClubRole = (typeof CLUB_ROLES)[number];

/** True only for a value in `CLUB_ROLES`. */
export function isClubRole(value: string): value is ClubRole {
  return (CLUB_ROLES as readonly string[]).includes(value);
}

/**
 * On the deny arm `actualRole` is the stored value verbatim, which is a
 * `ClubRole` unless the row holds something the schema should not admit.
 */
export type ClubRoleGuardResult =
  | { ok: true; role: ClubRole }
  | { ok: false; response: NextResponse; actualRole: string | null };

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

  // An unexpected stored value is a deny, never a permit.
  const role: string = membership.role;
  if (!isClubRole(role) || !acceptedRoles.includes(role)) {
    return {
      ok: false,
      response: forbidden(message),
      actualRole: role,
    };
  }

  return { ok: true, role };
}

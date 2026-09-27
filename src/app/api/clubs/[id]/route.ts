import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { requireClubRole } from "@/server/authz/requireClubRole";
import { getElevatedClient } from "@/server/db/elevated";
import type { TablesUpdate } from "@/lib/supabase/types";
import { parseBody } from "@/server/body";
import {
  CLUB_UPDATE_FIELD_KEYS,
  ClubDeleteBody,
  ClubUpdateBody,
} from "@/contracts/clubs";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/clubs/[id]
 * Public endpoint - returns club details with follower count.
 */
export const GET = withRoute({ cache: "public-60-300", action: "fetch club" }, async (_request: NextRequest, { params }: RouteParams) => {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();

    const [clubResult, followerResult] = await Promise.all([
      supabase.from("clubs").select("*").eq("id", clubId).single(),
      supabase
        .from("club_followers")
        .select("*", { count: "exact", head: true })
        .eq("club_id", clubId),
    ]);

    if (clubResult.error || !clubResult.data) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    return NextResponse.json({
      club: clubResult.data,
      followerCount: followerResult.count ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch club" },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/clubs/[id]
 * Owner-only endpoint - updates club details.
 *
 * The write runs on the elevated door AFTER the owner gate (F-087, DEC-41):
 * `clubs` has no owner UPDATE policy, so on the cookie client the update
 * matched 0 rows and the owner got a 500. The control that replaces RLS here
 * is the column whitelist: `updates` is built only from the contract's
 * `EDITABLE_CLUB_FIELDS` (src/contracts/clubs.ts), so
 * `status`, `created_by` and `id` can never be written through this path.
 * REGISTRY.md row: "Owner edits club details or soft-deletes the club".
 */
export const PATCH = withRoute({ cache: "private", action: "update club" }, async (request: NextRequest, { params }: RouteParams) => {
  try {
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    const { id: clubId } = await params;

    // Verify ownership
    const gate = await requireClubRole(
      supabase,
      clubId,
      user.id,
      ["owner"],
      "Only the club owner can update club details"
    );
    if (!gate.ok) return gate.response;

    // The contract (src/contracts/clubs.ts) is the handler's ladder, in its
    // order, after the owner gate: every whitelisted value a string or null
    // ("Invalid value for <field>", with field; REVIEW-05 WR-09); then each
    // link under ClubLinkFields (DEC-66: an absolute http(s) URL kept, a
    // scheme-less host path saved with https:// prefixed, any other scheme
    // refused as `Invalid URL for <field>`, so `javascript:` never reaches an
    // `href`); then the contact email format; then "No valid fields to
    // update". Its output is `updates`: only whitelisted keys that were sent,
    // each trimmed, a blank or null cleared to null. The whitelist is the
    // control that replaces RLS on this elevated write, so `status`,
    // `created_by` and `id` can never be written through this path.
    const parsed = await parseBody(request, ClubUpdateBody, {
      fieldFor: CLUB_UPDATE_FIELD_KEYS,
    });
    if (!parsed.ok) return parsed.response;
    // DI-25: the generated update type. A null for a NOT NULL column is
    // refused at the database, as before.
    const updates = parsed.data as TablesUpdate<"clubs">;

    const { data: club, error } = await getElevatedClient()
      .from("clubs")
      .update(updates)
      .eq("id", clubId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update club" },
        { status: 500 }
      );
    }

    return NextResponse.json({ club });
  } catch {
    return NextResponse.json(
      { error: "Failed to update club" },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/clubs/[id]
 * Owner-only endpoint - soft-deletes a club by setting status to "deleted".
 * Requires body: { confirmName: string }
 *
 * The soft-delete and its audit record run on the elevated door AFTER the
 * owner gate (F-087, DEC-41). On the cookie client the update matched 0 rows
 * and the handler still reported success. The payload is exactly
 * `{ status: "deleted" }`. REGISTRY.md rows: "Owner edits club details or
 * soft-deletes the club" and "Record a club deletion or ownership transfer in
 * admin_audit_log".
 */
export const DELETE = withRoute({ cache: "private", action: "delete club" }, async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await createRequestContext();
  const active = requireActiveUser(ctx);
  if (!active.ok) return active.response;
  const onboarded = requireOnboarded(ctx);
  if (!onboarded.ok) return onboarded.response;
  const user = active.user;
  const supabase = ctx.supabase;

  const { id: clubId } = await params;

  // Verify owner
  const gate = await requireClubRole(
    supabase,
    clubId,
    user.id,
    ["owner"],
    "Only the club owner can delete the club"
  );
  if (!gate.ok) return gate.response;

  // Verify confirmation name. The body is read after the owner gate; the
  // match against the club's name is a business rule and stays here.
  const parsed = await parseBody(request, ClubDeleteBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const { data: club } = await supabase
    .from("clubs")
    .select("name")
    .eq("id", clubId)
    .single();

  if (!club || body.confirmName !== club.name) {
    return NextResponse.json({ error: "Club name confirmation does not match" }, { status: 400 });
  }

  const elevated = getElevatedClient();

  // Soft delete - set status to deleted
  const { error } = await elevated
    .from("clubs")
    .update({ status: "deleted" })
    .eq("id", clubId);

  if (error) {
    return NextResponse.json({ error: "Failed to delete club" }, { status: 500 });
  }

  // Audit log. A failed audit write does not undo the deletion, but it is
  // never silent.
  const { error: auditError } = await elevated.from("admin_audit_log").insert({
    admin_user_id: user.id,
    action: "club_deleted",
    target_type: "club",
    target_id: clubId,
    metadata: { club_name: club.name },
  });
  if (auditError) {
    log.error("audit insert failed", {
      scope: "clubs/delete",
      requestId: ctx.requestId,
      clubId,
      error: auditError,
    });
  }

  return NextResponse.json({ success: true });
});

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { requireClubRole } from "@/server/authz/requireClubRole";
import { getElevatedClient } from "@/server/db/elevated";
import type { TablesUpdate } from "@/lib/supabase/types";
import { readJsonObject } from "@/server/body";
import { isHttpUrl } from "@/lib/sanitize";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/clubs/[id]
 * Public endpoint - returns club details with follower count.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
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
}

/**
 * PATCH /api/clubs/[id]
 * Owner-only endpoint - updates club details.
 *
 * The write runs on the elevated door AFTER the owner gate (F-087, DEC-41):
 * `clubs` has no owner UPDATE policy, so on the cookie client the update
 * matched 0 rows and the owner got a 500. The control that replaces RLS here
 * is the column whitelist: `updates` is built only from `allowedFields`, so
 * `status`, `created_by` and `id` can never be written through this path.
 * REGISTRY.md row: "Owner edits club details or soft-deletes the club".
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json();
    const allowedFields = [
      "name",
      "description",
      "category",
      "instagram_handle",
      "logo_url",
      "banner_url",
      "website_url",
      "discord_url",
      "twitter_url",
      "linkedin_url",
      "contact_email",
    ] as const;

    // DI-25: typed with the generated update type. Only whitelisted columns.
    // The whitelist is the control that replaces RLS on this elevated write,
    // so every value must be a string or null (REVIEW-05 WR-09): any other
    // JSON type is refused rather than passed through.
    const updates: TablesUpdate<"clubs"> = {};
    for (const field of allowedFields) {
      if (field in body) {
        const value: unknown = body[field];
        if (value !== null && typeof value !== "string") {
          return NextResponse.json(
            { error: `Invalid value for ${field}`, field },
            { status: 400 }
          );
        }
        // A blank string or null clears the column, as before; a NOT NULL
        // column refuses the null at the database, as before.
        (updates as Record<string, string | null>)[field] =
          typeof value === "string" ? value.trim() || null : null;
      }
    }

    // Validate URL fields: absolute http(s) only (REVIEW-05 WR-09). `new
    // URL()` alone accepted `javascript:`, and the club page renders these as
    // `href`. logo_url and banner_url, previously unchecked, are held to the
    // same rule.
    const urlFields = [
      "website_url",
      "discord_url",
      "twitter_url",
      "linkedin_url",
      "logo_url",
      "banner_url",
    ] as const;
    for (const field of urlFields) {
      const value = updates[field];
      if (typeof value === "string" && !isHttpUrl(value)) {
        return NextResponse.json(
          { error: `Invalid URL for ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate contact_email format
    if (updates.contact_email !== undefined && updates.contact_email !== null) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.contact_email)) {
        return NextResponse.json({ error: "Invalid email format for contact_email" }, { status: 400 });
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

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
}

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
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // Verify confirmation name
  const parsedBody = await readJsonObject(request);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;
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
    console.error(
      `[clubs/delete] audit insert failed (requestId ${ctx.requestId}):`,
      auditError
    );
  }

  return NextResponse.json({ success: true });
}

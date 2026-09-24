import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { getElevatedClient } from "@/server/db/elevated";
import { logAdminAction } from "@/lib/audit";
import { REJECTION_CATEGORIES, type RejectionCategory } from "@/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const { id } = await params;
  const body = await request.json();
  const { status, category, message: rejectionMessage } = body;

  if (!["approved", "rejected", "suspended"].includes(status)) {
    return NextResponse.json(
      { error: "Status must be 'approved', 'rejected', or 'suspended'" },
      { status: 400 }
    );
  }

  if (status === "rejected") {
    if (!category || !rejectionMessage?.trim()) {
      return NextResponse.json(
        { error: "Rejection requires category and message" },
        { status: 400 }
      );
    }
    if (!(category in REJECTION_CATEGORIES)) {
      return NextResponse.json(
        { error: "Invalid rejection category" },
        { status: 400 }
      );
    }
  }

  if (status === "suspended") {
    if (!category || !rejectionMessage?.trim()) {
      return NextResponse.json(
        { error: "Suspension requires category and message" },
        { status: 400 }
      );
    }
    if (!(category in REJECTION_CATEGORIES)) {
      return NextResponse.json(
        { error: "Invalid suspension category" },
        { status: 400 }
      );
    }
  }

  // The club read and update, the moderation review and the owner membership
  // run on the caller's cookie client: the admin policies on clubs
  // ("Admins can update clubs"), moderation_reviews ("Admins full access") and
  // club_members ("Admins manage memberships") permit them (DEC-49). Only the
  // creator's roles write and the notifications go through the elevated door.
  const supabase = ctx.supabase;

  const { data: club, error: fetchError } = await supabase
    .from("clubs")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  // Transition guard: only allow valid status transitions
  const allowedTransitions: Record<string, string[]> = {
    pending: ["approved", "rejected"],
    approved: ["suspended"],
    suspended: ["approved", "rejected"],
    rejected: [], // appeals handle rejected → pending
  };

  const allowed = allowedTransitions[club.status] || [];
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition from '${club.status}' to '${status}'` },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabase
    .from("clubs")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Insert moderation review row
  if (status === "rejected") {
    await supabase.from("moderation_reviews").insert({
      target_type: "club",
      target_id: id,
      action: "rejection",
      category: category as RejectionCategory,
      message: rejectionMessage.trim(),
      author_id: user.id,
    });
  } else if (status === "suspended") {
    await supabase.from("moderation_reviews").insert({
      target_type: "club",
      target_id: id,
      action: "suspension",
      category: category as RejectionCategory,
      message: rejectionMessage.trim(),
      author_id: user.id,
    });
  } else if (status === "approved" && club.status === "suspended") {
    await supabase.from("moderation_reviews").insert({
      target_type: "club",
      target_id: id,
      action: "unsuspension",
      category: null,
      message: "Club unsuspended and approved.",
      author_id: user.id,
    });
  } else if (status === "approved" && (club.appeal_count ?? 0) > 0) {
    await supabase.from("moderation_reviews").insert({
      target_type: "club",
      target_id: id,
      action: "approval",
      category: null,
      message: "Club approved.",
      author_id: user.id,
    });
  }

  // Log audit action
  try {
    const auditAction =
      status === "approved" && club.status === "suspended"
        ? "unsuspended"
        : (status as "approved" | "rejected" | "suspended");
    await logAdminAction({
      adminUserId: user.id,
      requestId: ctx.requestId,
      action: auditAction,
      targetType: "club",
      targetId: id,
      metadata: { club_name: club.name },
    });
  } catch (auditErr) {
    console.error("[Admin] Failed to log audit action:", auditErr);
  }

  if (status === "approved" && club.created_by) {
    // Skip role assignment and club_members upsert when unsuspending (user already has them)
    if (club.status !== "suspended") {
      // Reading another user's roles is permitted to an admin ("Admins can view
      // all profiles"); writing them is not: users has no admin UPDATE policy
      // and the F-006 grant withholds roles. REGISTRY.md row: "Set another
      // user's roles on approval (club_organizer)".
      const { data: targetUser } = await supabase
        .from("users")
        .select("roles")
        .eq("id", club.created_by)
        .single();

      if (targetUser && !targetUser.roles?.includes("club_organizer")) {
        const updatedRoles = [...(targetUser.roles || []), "club_organizer"] as ("user" | "club_organizer" | "admin")[];
        await getElevatedClient()
          .from("users")
          .update({
            roles: updatedRoles,
            updated_at: new Date().toISOString(),
          })
          .eq("id", club.created_by);
      }

      await supabase.from("club_members").upsert(
        {
          user_id: club.created_by,
          club_id: id,
          role: "owner",              // DBROLE-06: creator becomes owner, not organizer
        },
        { onConflict: "user_id,club_id" }
      );
    }

    try {
      // notifications INSERT is granted to service_role only. REGISTRY.md row:
      // "Notify another user (notifications insert)".
      await getElevatedClient().from("notifications").insert({
        user_id: club.created_by,
        type: "club_approved",
        title: "Club Approved!",
        message: `Your club "${club.name}" has been approved. You are now the owner and can create events.`,
      });
    } catch (notifErr) {
      console.error("[Admin] Failed to send club notification:", notifErr);
    }
  }

  if (status === "suspended" && club.created_by) {
    try {
      const categoryLabel = REJECTION_CATEGORIES[category as RejectionCategory];
      await getElevatedClient().from("notifications").insert({
        user_id: club.created_by,
        type: "club_suspended",
        title: "Club Suspended",
        message: `Your club "${club.name}" has been suspended. Reason: ${categoryLabel} — ${rejectionMessage.trim()}`,
        club_id: id,
      });
    } catch (notifErr) {
      console.error("[Admin] Failed to send club notification:", notifErr);
    }
  }

  if (status === "rejected" && club.created_by) {
    try {
      const categoryLabel = REJECTION_CATEGORIES[category as RejectionCategory];
      await getElevatedClient().from("notifications").insert({
        user_id: club.created_by,
        type: "club_rejected",
        title: "Club Not Approved",
        message: `Your club "${club.name}" was not approved. Reason: ${categoryLabel} — ${rejectionMessage.trim()}`,
        club_id: id,
      });
    } catch (notifErr) {
      console.error("[Admin] Failed to send club notification:", notifErr);
    }
  }

  return NextResponse.json({ success: true });
}

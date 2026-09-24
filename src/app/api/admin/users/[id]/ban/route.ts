import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { logAdminAction } from "@/lib/audit";
import { getElevatedClient } from "@/server/db/elevated";

/**
 * POST /api/admin/users/[id]/ban — Ban a user
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const { id } = await params;

  let body: {
    reason?: string;
    duration_days?: number;
    suspend_content?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { reason, duration_days, suspend_content } = body;

  // Validate reason
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json(
      { error: "Reason is required" },
      { status: 400 }
    );
  }

  // Validate duration_days if provided
  if (
    duration_days !== undefined &&
    duration_days !== null &&
    (!Number.isInteger(duration_days) || duration_days <= 0)
  ) {
    return NextResponse.json(
      { error: "duration_days must be a positive integer" },
      { status: 400 }
    );
  }

  // Reads, the content suspension and its moderation reviews run on the
  // caller's cookie client: the admin policies on users (SELECT), events,
  // clubs and moderation_reviews permit them (DEC-49). The ban columns and the
  // notification go through the elevated door.
  const supabase = ctx.supabase;

  // Prevent self-ban
  if (id === user.id) {
    return NextResponse.json({ error: "Cannot ban your own account" }, { status: 400 });
  }

  // Check target user exists
  const { data: targetUser, error: fetchError } = await supabase
    .from("users")
    .select("id, name, banned_at, roles")
    .eq("id", id)
    .single();

  if (fetchError || !targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Prevent banning admins
  if ((targetUser.roles as string[])?.includes("admin")) {
    return NextResponse.json({ error: "Cannot ban an admin account" }, { status: 403 });
  }

  // Check not already banned
  if (targetUser.banned_at) {
    return NextResponse.json(
      { error: "User is already banned" },
      { status: 409 }
    );
  }

  // Calculate ban_expires_at
  const now = new Date();
  let banExpiresAt: string | null = null;
  if (duration_days) {
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + duration_days);
    banExpiresAt = expiresAt.toISOString();
  }

  // Update user with ban fields. users has no admin UPDATE policy and the
  // F-006 grant withholds the ban columns. REGISTRY.md row: "Ban or unban a
  // user (banned_at, ban_expires_at, ban_reason)".
  const { error: updateError } = await getElevatedClient()
    .from("users")
    .update({
      banned_at: now.toISOString(),
      ban_expires_at: banExpiresAt,
      ban_reason: reason.trim(),
      banned_by: user.id,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // If suspend_content, batch-update user's approved events and clubs to "suspended"
  // and create moderation_reviews records for each
  const warnings: string[] = [];
  if (suspend_content) {
    // Fetch affected items first for moderation_reviews
    const { data: approvedEvents, error: evtFetchErr } = await supabase
      .from("events")
      .select("id, title")
      .eq("created_by", id)
      .eq("status", "approved");

    if (evtFetchErr) {
      console.error("Failed to fetch user events for suspension:", evtFetchErr);
      warnings.push("Failed to fetch events for suspension");
    }

    const { data: approvedClubs, error: clubFetchErr } = await supabase
      .from("clubs")
      .select("id, name")
      .eq("created_by", id)
      .eq("status", "approved");

    if (clubFetchErr) {
      console.error("Failed to fetch user clubs for suspension:", clubFetchErr);
      warnings.push("Failed to fetch clubs for suspension");
    }

    // Suspend events
    if (approvedEvents && approvedEvents.length > 0) {
      const { error: evtUpdateErr } = await supabase
        .from("events")
        .update({ status: "suspended", updated_at: now.toISOString() })
        .eq("created_by", id)
        .eq("status", "approved");

      if (evtUpdateErr) {
        console.error("Failed to suspend user events:", evtUpdateErr);
        warnings.push("Some events may not have been suspended");
      }

      // Create moderation_reviews for each suspended event
      const { error: evtReviewErr } = await supabase.from("moderation_reviews").insert(
        approvedEvents.map((event) => ({
          target_type: "event",
          target_id: event.id,
          action: "suspension",
          category: null,
          message: `Suspended due to user ban. Reason: ${reason.trim()}`,
          author_id: user.id,
        }))
      );

      if (evtReviewErr) {
        console.error("Failed to create event moderation reviews:", evtReviewErr);
        warnings.push("Some event moderation reviews may not have been created");
      }
    }

    // Suspend clubs
    if (approvedClubs && approvedClubs.length > 0) {
      const { error: clubUpdateErr } = await supabase
        .from("clubs")
        .update({ status: "suspended", updated_at: now.toISOString() })
        .eq("created_by", id)
        .eq("status", "approved");

      if (clubUpdateErr) {
        console.error("Failed to suspend user clubs:", clubUpdateErr);
        warnings.push("Some clubs may not have been suspended");
      }

      // Create moderation_reviews for each suspended club
      const { error: clubReviewErr } = await supabase.from("moderation_reviews").insert(
        approvedClubs.map((club) => ({
          target_type: "club",
          target_id: club.id,
          action: "suspension",
          category: null,
          message: `Suspended due to user ban. Reason: ${reason.trim()}`,
          author_id: user.id,
        }))
      );

      if (clubReviewErr) {
        console.error("Failed to create club moderation reviews:", clubReviewErr);
        warnings.push("Some club moderation reviews may not have been created");
      }
    }
  }

  // Send notification
  try {
    const durationText = duration_days
      ? `${duration_days} day${duration_days > 1 ? "s" : ""}`
      : "permanently";

    // REGISTRY.md row: "Notify another user (notifications insert)".
    await getElevatedClient().from("notifications").insert({
      user_id: id,
      type: "user_banned",
      title: "Account Banned",
      message: `Your account has been banned ${durationText}. Reason: ${reason.trim()}`,
      read: false,
      created_at: now.toISOString(),
    });
  } catch (notifErr) {
    console.error("[Admin] Failed to send ban notification:", notifErr);
  }

  // Log audit action
  try {
    await logAdminAction({
      adminUserId: user.id,
      requestId: ctx.requestId,
      action: "banned",
      targetType: "user",
      targetId: id,
      metadata: {
        user_name: targetUser.name,
        reason: reason.trim(),
        duration_days: duration_days ?? null,
        permanent: !duration_days,
        suspend_content: !!suspend_content,
      },
    });
  } catch (auditErr) {
    console.error("[Admin] Failed to log audit action:", auditErr);
  }

  return NextResponse.json({
    success: true,
    ...(warnings.length > 0 && { warnings }),
  });
}

/**
 * DELETE /api/admin/users/[id]/ban — Unban a user
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const { id } = await params;

  // The target read runs on the cookie client ("Admins can view all
  // profiles"); clearing the ban and the notification go through the door.
  const supabase = ctx.supabase;

  // Check target user exists and is banned
  const { data: targetUser, error: fetchError } = await supabase
    .from("users")
    .select("id, name, banned_at")
    .eq("id", id)
    .single();

  if (fetchError || !targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!targetUser.banned_at) {
    return NextResponse.json(
      { error: "User is not currently banned" },
      { status: 409 }
    );
  }

  // Clear only banned_at and ban_expires_at (preserve ban_reason and banned_by for history).
  // REGISTRY.md row: "Ban or unban a user (banned_at, ban_expires_at, ban_reason)".
  const { error: updateError } = await getElevatedClient()
    .from("users")
    .update({
      banned_at: null,
      ban_expires_at: null,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Send notification
  try {
    // REGISTRY.md row: "Notify another user (notifications insert)".
    await getElevatedClient().from("notifications").insert({
      user_id: id,
      type: "user_unbanned",
      title: "Account Unbanned",
      message:
        "Your account has been unbanned. You can now use the platform again.",
      read: false,
      created_at: new Date().toISOString(),
    });
  } catch (notifErr) {
    console.error("[Admin] Failed to send unban notification:", notifErr);
  }

  // Log audit action
  try {
    await logAdminAction({
      adminUserId: user.id,
      requestId: ctx.requestId,
      action: "unbanned",
      targetType: "user",
      targetId: id,
      metadata: {
        user_name: targetUser.name,
      },
    });
  } catch (auditErr) {
    console.error("[Admin] Failed to log audit action:", auditErr);
  }

  return NextResponse.json({ success: true });
}

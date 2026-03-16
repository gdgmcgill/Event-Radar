import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/audit";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/admin/users/[id]/ban — Ban a user
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const serviceClient = createServiceClient();

  // Check target user exists
  const { data: targetUser, error: fetchError } = await serviceClient
    .from("users")
    .select("id, name, banned_at")
    .eq("id", id)
    .single();

  if (fetchError || !targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
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

  // Update user with ban fields
  const { error: updateError } = await serviceClient
    .from("users")
    .update({
      banned_at: now.toISOString(),
      ban_expires_at: banExpiresAt,
      ban_reason: reason.trim(),
      banned_by: user.id,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // If suspend_content, batch-update user's approved events and clubs to "suspended"
  // and create moderation_reviews records for each
  if (suspend_content) {
    // Fetch affected items first for moderation_reviews
    const { data: approvedEvents } = await serviceClient
      .from("events")
      .select("id, title")
      .eq("created_by", id)
      .eq("status", "approved");

    const { data: approvedClubs } = await serviceClient
      .from("clubs")
      .select("id, name")
      .eq("created_by", id)
      .eq("status", "approved");

    // Suspend events
    if (approvedEvents && approvedEvents.length > 0) {
      await serviceClient
        .from("events")
        .update({ status: "suspended", updated_at: now.toISOString() })
        .eq("created_by", id)
        .eq("status", "approved");

      // Create moderation_reviews for each suspended event
      await serviceClient.from("moderation_reviews").insert(
        approvedEvents.map((event) => ({
          target_type: "event",
          target_id: event.id,
          action: "suspension",
          category: null,
          message: `Suspended due to user ban. Reason: ${reason.trim()}`,
          author_id: user.id,
        }))
      );
    }

    // Suspend clubs
    if (approvedClubs && approvedClubs.length > 0) {
      await serviceClient
        .from("clubs")
        .update({ status: "suspended", updated_at: now.toISOString() })
        .eq("created_by", id)
        .eq("status", "approved");

      // Create moderation_reviews for each suspended club
      await serviceClient.from("moderation_reviews").insert(
        approvedClubs.map((club) => ({
          target_type: "club",
          target_id: club.id,
          action: "suspension",
          category: null,
          message: `Suspended due to user ban. Reason: ${reason.trim()}`,
          author_id: user.id,
        }))
      );
    }
  }

  // Send notification
  try {
    const durationText = duration_days
      ? `${duration_days} day${duration_days > 1 ? "s" : ""}`
      : "permanently";

    await serviceClient.from("notifications").insert({
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
      adminEmail: user.email,
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

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/admin/users/[id]/ban — Unban a user
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const serviceClient = createServiceClient();

  // Check target user exists and is banned
  const { data: targetUser, error: fetchError } = await serviceClient
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

  // Clear only banned_at and ban_expires_at (preserve ban_reason and banned_by for history)
  const { error: updateError } = await serviceClient
    .from("users")
    .update({
      banned_at: null,
      ban_expires_at: null,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Send notification
  try {
    await serviceClient.from("notifications").insert({
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
      adminEmail: user.email,
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

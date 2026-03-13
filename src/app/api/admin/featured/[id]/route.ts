import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { sanitizeText } from "@/lib/sanitize";
import { logAdminAction } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.sponsor_name !== undefined) {
      updates.sponsor_name = body.sponsor_name
        ? sanitizeText(body.sponsor_name)
        : null;
    }
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.starts_at !== undefined) updates.starts_at = body.starts_at;
    if (body.ends_at !== undefined) updates.ends_at = body.ends_at;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("featured_events")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      await logAdminAction({
        adminUserId: user.id,
        adminEmail: user.email,
        action: "updated",
        targetType: "featured_event",
        targetId: id,
        metadata: updates,
      });
    } catch (auditErr) {
      console.error("[Admin] Failed to log audit action:", auditErr);
    }

    return NextResponse.json({ featured: data });
  } catch {
    return NextResponse.json(
      { error: "Failed to update featured event" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const { error } = await supabase
      .from("featured_events")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      await logAdminAction({
        adminUserId: user.id,
        adminEmail: user.email,
        action: "deleted",
        targetType: "featured_event",
        targetId: id,
      });
    } catch (auditErr) {
      console.error("[Admin] Failed to log audit action:", auditErr);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete featured event" },
      { status: 500 }
    );
  }
}

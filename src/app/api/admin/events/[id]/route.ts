import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/audit";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const allowedFields = [
    "title", "description", "start_date", "end_date",
    "location", "organizer", "tags", "image_url",
    "category", "status",
  ];

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  for (const field of allowedFields) {
    if (field in body) {
      updateData[field] = body[field];
    }
  }

  // If admin directly edits title or image_url, clear any pending user edits
  if ("title" in updateData || "image_url" in updateData) {
    updateData.pending_edits = null;
  }

  const { data, error } = await supabase
    .from("events")
    .update(updateData)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Log audit action
  try {
    if (user) {
      await logAdminAction({
        adminUserId: user.id,
        adminEmail: user.email,
        action: "updated",
        targetType: "event",
        targetId: id,
        metadata: { fields_updated: Object.keys(body) },
      });
    }
  } catch (auditErr) {
    console.error("[Admin] Failed to log audit action:", auditErr);
  }

  return NextResponse.json({ event: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { error } = await supabase
    .from("events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Log audit action
  try {
    if (user) {
      await logAdminAction({
        adminUserId: user.id,
        adminEmail: user.email,
        action: "deleted",
        targetType: "event",
        targetId: id,
      });
    }
  } catch (auditErr) {
    console.error("[Admin] Failed to log audit action:", auditErr);
  }

  return NextResponse.json({ success: true });
}

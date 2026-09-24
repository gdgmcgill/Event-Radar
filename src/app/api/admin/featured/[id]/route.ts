import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { sanitizeText } from "@/lib/sanitize";
import { logAdminAction } from "@/lib/audit";
import type { Json } from "@/lib/supabase/types";

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
  const supabase = ctx.supabase;

  try {
    const { id } = await params;
    const body = await request.json();
    // Narrowed from `Record<string, unknown>` to the generated JSON type: this
    // object is both the PATCH body for `featured_events` and the audit-log
    // metadata, and `unknown` admits values neither column can hold.
    const updates: Record<string, Json> = {};

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
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    try {
      await logAdminAction({
        adminUserId: user.id,
        requestId: ctx.requestId,
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
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const supabase = ctx.supabase;

  try {
    const { id } = await params;

    const { error } = await supabase
      .from("featured_events")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    try {
      await logAdminAction({
        adminUserId: user.id,
        requestId: ctx.requestId,
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

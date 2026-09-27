import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { logAdminAction } from "@/lib/audit";
import { parseBody } from "@/server/body";
import { AdminEventPutBody } from "@/contracts/admin";
import type { TablesUpdate } from "@/lib/supabase/types";

export async function PUT(
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

  const { id } = await params;
  // The ten allowed fields, each typed as its column, only when sent; `sent`
  // is every key of the body, for the audit row (src/contracts/admin.ts).
  const parsed = await parseBody(request, AdminEventPutBody);
  if (!parsed.ok) return parsed.response;
  const { sent, updates } = parsed.data;

  // Typed as the events update (DI-53): no key outside the contract.
  const updateData: TablesUpdate<"events"> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

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
        requestId: ctx.requestId,
        action: "updated",
        targetType: "event",
        targetId: id,
        metadata: { fields_updated: sent },
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
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const supabase = ctx.supabase;

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
        requestId: ctx.requestId,
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

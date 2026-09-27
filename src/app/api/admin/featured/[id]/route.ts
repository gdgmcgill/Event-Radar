import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { logAdminAction } from "@/lib/audit";
import { parseBody } from "@/server/body";
import { FeaturedUpdateBody } from "@/contracts/admin";
import type { TablesUpdate } from "@/lib/supabase/types";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

export const PATCH = withRoute({ cache: "private", action: "update featured event" }, async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const supabase = ctx.supabase;

  try {
    const { id } = await params;
    // sponsor_name (sanitized, or null when falsy), priority, starts_at and
    // ends_at, each only when sent; none sent is "No fields to update"
    // (src/contracts/admin.ts).
    const parsed = await parseBody(request, FeaturedUpdateBody);
    if (!parsed.ok) return parsed.response;
    // Typed as the featured_events update (DI-53). The same object is the
    // audit-log metadata below.
    const updates: TablesUpdate<"featured_events"> = parsed.data;

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
      log.error("Failed to log audit action", { scope: "Admin", error: auditErr });
    }

    return NextResponse.json({ featured: data });
  } catch {
    return NextResponse.json(
      { error: "Failed to update featured event" },
      { status: 500 }
    );
  }
});

export const DELETE = withRoute({ cache: "private", action: "delete featured event" }, async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
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
      log.error("Failed to log audit action", { scope: "Admin", error: auditErr });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete featured event" },
      { status: 500 }
    );
  }
});

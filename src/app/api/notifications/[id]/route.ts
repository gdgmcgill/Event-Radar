import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

/**
 * PATCH /api/notifications/[id] - Mark a single notification as read
 */

export const PATCH = withRoute({ cache: "private", action: "update notification" }, async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    const { id } = await params;

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      log.error("Error marking notification read", { notificationId: id, error });
      return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error updating notification", { error });
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 }
    );
  }
});

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { ids?: unknown; status?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ids, status, reason } = body as {
    ids: string[];
    status: "approved" | "rejected";
    reason?: string;
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (status === "rejected" && !reason?.trim()) {
    return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 });
  }

  // Only touch events that are still pending — prevents accidentally
  // re-processing events another admin already acted on in parallel.
  const { error } = await supabase
    .from("events")
    .update({ status, updated_at: new Date().toISOString() })
    .in("id", ids)
    .eq("status", "pending");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire notifications for each event (best-effort)
  try {
    const serviceClient = createServiceClient();
    const { data: events } = await serviceClient
      .from("events")
      .select("id, title, created_by")
      .in("id", ids);

    if (events && events.length > 0) {
      const isApproved = status === "approved";
      const notifications = events
        .filter((e) => e.created_by)
        .map((e) => ({
          user_id: e.created_by as string,
          type: isApproved ? "event_approved" : "event_rejected",
          title: isApproved ? "Event Approved!" : "Event Not Approved",
          message: isApproved
            ? `Your event "${e.title}" has been approved and is now live.`
            : `Your event "${e.title}" was not approved${reason ? `: ${reason}` : "."}`,
          event_id: e.id,
        }));

      if (notifications.length > 0) {
        await serviceClient.from("notifications").insert(notifications);
      }
    }
  } catch (notifErr) {
    console.error("[Admin] Failed to send bulk notifications:", notifErr);
  }

  return NextResponse.json({ success: true, count: ids.length });
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { logAdminAction } from "@/lib/audit";

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
  const { status } = body;

  if (!["reviewed", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // "Admins can read all reports" and "Admins can update reports" permit the
  // read and the update on the cookie client, so no elevated client is needed
  // (DEC-49).
  const supabase = ctx.supabase;

  const { data: report, error: fetchError } = await supabase
    .from("event_reports")
    .select("id, event_id, status")
    .eq("id", id)
    .single();

  if (fetchError || !report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (report.status !== "pending") {
    return NextResponse.json(
      { error: "Report has already been actioned" },
      { status: 409 }
    );
  }

  // Conditional on the report still being pending (REVIEW-05 WR-07), so a
  // concurrent second action changes nothing and writes no second audit row.
  const { data: updated, error: updateError } = await supabase
    .from("event_reports")
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");

  if (updateError) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: "Report has already been actioned" },
      { status: 409 }
    );
  }

  try {
    await logAdminAction({
      adminUserId: user.id,
      requestId: ctx.requestId,
      action: status === "reviewed" ? "report_reviewed" : "report_dismissed",
      targetType: "event_report",
      targetId: id,
      metadata: { event_id: report.event_id },
    });
  } catch (auditErr) {
    console.error("[Admin] Failed to log audit action:", auditErr);
  }

  return NextResponse.json({ success: true });
}

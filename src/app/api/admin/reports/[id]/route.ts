import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (!["reviewed", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: report, error: fetchError } = await (supabase as any)
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

  const { error: updateError } = await (supabase as any)
    .from("event_reports")
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  try {
    await logAdminAction({
      adminUserId: user.id,
      adminEmail: user.email,
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

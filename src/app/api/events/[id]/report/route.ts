import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { sanitizeText } from "@/lib/sanitize";
import { parseBody } from "@/server/body";
import { EventReportBody } from "@/contracts/events";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

export const POST = withRoute({ cache: "private", action: "report event" }, async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await createRequestContext();
  const active = requireActiveUser(ctx);
  if (!active.ok) return active.response;
  const onboarded = requireOnboarded(ctx);
  if (!onboarded.ok) return onboarded.response;
  const user = active.user;
  const supabase = ctx.supabase;

  const { id: eventId } = await params;
  // The contract (plan 06-08, REFAC-15): "Invalid category" unless the
  // category is one of REJECTION_CATEGORIES. F-094: a non-string message is
  // a 400 (it threw inside sanitizeText) (INTENTIONAL BEHAVIOUR CHANGE).
  const parsed = await parseBody(request, EventReportBody);
  if (!parsed.ok) return parsed.response;
  const { category, message } = parsed.data;

  // Validate event exists and is approved
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, status, created_by")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status !== "approved") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Prevent self-reporting
  if (event.created_by === user.id) {
    return NextResponse.json(
      { error: "Cannot report your own event" },
      { status: 403 }
    );
  }

  // Insert report (unique constraint handles duplicate prevention)
  const { error: insertError } = await supabase
    .from("event_reports")
    .insert({
      event_id: eventId,
      reporter_id: user.id,
      category,
      message: message ? sanitizeText(message).slice(0, 500) : null,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "You have already reported this event" },
        { status: 409 }
      );
    }
    log.error("Failed to insert event report", { eventId, error: insertError });
    return NextResponse.json({ error: "Failed to report event" }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
});

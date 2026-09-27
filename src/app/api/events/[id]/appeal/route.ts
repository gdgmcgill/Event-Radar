import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getElevatedClient } from "@/server/db/elevated";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { parseBody } from "@/server/body";
import { EventAppealBody } from "@/contracts/events";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

export const POST = withRoute({ cache: "private", action: "submit appeal" }, async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await createRequestContext();
  const active = requireActiveUser(ctx);
  if (!active.ok) return active.response;
  const onboarded = requireOnboarded(ctx);
  if (!onboarded.ok) return onboarded.response;
  const user = active.user;

  const { id } = await params;
  // The contract (plan 06-08, REFAC-15): "Appeal message is required" for a
  // missing or blank message. F-094: a non-string message is that 400 (it
  // threw on .trim(), an HTML 500) (INTENTIONAL BEHAVIOUR CHANGE).
  const parsed = await parseBody(request, EventAppealBody);
  if (!parsed.ok) return parsed.response;
  const { message } = parsed.data;

  // The appeal review ("Creators can appeal their items"), the status reset
  // ("Organizers can update own events") and the final re-read ("Organizers
  // can view own events") run on the caller's cookie client (DEC-49). The
  // pre-read, the admin lookup and the admin notifications go through the
  // elevated door.
  const supabase = ctx.supabase;

  // The pre-read runs before the creator check. On the cookie client a
  // non-creator could not see a rejected or suspended event and would get 404
  // "Event not found" where this route answers 403 "Forbidden". REGISTRY.md
  // row: "Read an appealed event before the creator check".
  const { data: event, error: fetchError } = await getElevatedClient()
    .from("events")
    .select("id, title, created_by, status, appeal_count")
    .eq("id", id)
    .single();

  if (fetchError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["rejected", "suspended"].includes(event.status)) {
    return NextResponse.json(
      { error: "Only rejected or suspended events can be appealed" },
      { status: 409 }
    );
  }

  const { error: reviewError } = await supabase
    .from("moderation_reviews")
    .insert({
      target_type: "event",
      target_id: id,
      action: "appeal",
      category: null,
      message: message.trim(),
      author_id: user.id,
    });

  if (reviewError) {
    log.error("Failed to insert appeal review", { scope: "Appeal", eventId: id, error: reviewError });
    return NextResponse.json({ error: "Failed to submit appeal" }, { status: 500 });
  }

  const { data: updateData, error: updateError } = await supabase
    .from("events")
    .update({
      status: "pending",
      appeal_count: (event.appeal_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", event.status)
    .select("id");

  if (updateError) {
    log.error("Failed to reset event to pending", { scope: "Appeal", eventId: id, error: updateError });
    return NextResponse.json({ error: "Failed to submit appeal" }, { status: 500 });
  }

  if (!updateData || updateData.length === 0) {
    return NextResponse.json({ error: "Appeal already processed" }, { status: 409 });
  }

  try {
    // users shows another user's row only to admins. REGISTRY.md row: "Read
    // another user's name for appeals and review listings".
    const { data: admins } = await getElevatedClient()
      .from("users")
      .select("id")
      .contains("roles", ["admin"]);

    if (admins && admins.length > 0) {
      // REGISTRY.md row: "Notify another user (notifications insert)".
      await getElevatedClient().from("notifications").insert(
        admins.map((admin) => ({
          user_id: admin.id,
          type: "event_appeal",
          title: "Event Appeal Submitted",
          message: `An appeal was submitted for event "${event.title}"`,
          event_id: id,
          read: false,
        }))
      );
    }
  } catch (notifErr) {
    log.error("Failed to send admin notifications", { scope: "Appeal", eventId: id, error: notifErr });
  }

  const { data: updatedEvent } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json({ success: true, event: updatedEvent });
});

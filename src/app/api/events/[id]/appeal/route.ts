import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getElevatedClient } from "@/server/db/elevated";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { readJsonObject } from "@/server/body";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await createRequestContext();
  const active = requireActiveUser(ctx);
  if (!active.ok) return active.response;
  const onboarded = requireOnboarded(ctx);
  if (!onboarded.ok) return onboarded.response;
  const user = active.user;

  const { id } = await params;
  const parsedBody = await readJsonObject(request);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;
  const { message } = body;

  if (!message?.trim()) {
    return NextResponse.json(
      { error: "Appeal message is required" },
      { status: 400 }
    );
  }

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
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
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
    return NextResponse.json({ error: updateError.message }, { status: 500 });
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
    console.error("[Appeal] Failed to send admin notifications:", notifErr);
  }

  const { data: updatedEvent } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json({ success: true, event: updatedEvent });
}

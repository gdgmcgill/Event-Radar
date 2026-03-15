import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { message } = body;

  if (!message?.trim()) {
    return NextResponse.json(
      { error: "Appeal message is required" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  const { data: event, error: fetchError } = await serviceClient
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

  if (event.status !== "rejected") {
    return NextResponse.json(
      { error: "Only rejected events can be appealed" },
      { status: 409 }
    );
  }

  const { error: reviewError } = await serviceClient
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

  const { error: updateError } = await serviceClient
    .from("events")
    .update({
      status: "pending",
      appeal_count: (event.appeal_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  try {
    const { data: admins } = await serviceClient
      .from("users")
      .select("id")
      .contains("roles", ["admin"]);

    if (admins && admins.length > 0) {
      await serviceClient.from("notifications").insert(
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

  const { data: updatedEvent } = await serviceClient
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json({ success: true, event: updatedEvent });
}

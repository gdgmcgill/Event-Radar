import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/sanitize";
import { REJECTION_CATEGORIES } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: eventId } = await params;
  const body = await request.json();
  const { category, message } = body;

  // Validate category
  if (!category || !(category in REJECTION_CATEGORIES)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

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
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

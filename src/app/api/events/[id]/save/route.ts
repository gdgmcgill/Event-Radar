/**
 * POST /api/events/:id/save - Toggle save/unsave for the authenticated user
 * DELETE /api/events/:id/save - Unsave an event
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id: eventId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error: deleteError } = await supabase
      .from("saved_events")
      .delete()
      .eq("user_id", user.id)
      .eq("event_id", eventId);

    if (deleteError) {
      console.error("Error deleting saved event:", deleteError);
      return NextResponse.json({ error: "Failed to unsave event" }, { status: 500 });
    }

    return NextResponse.json({ saved: false });
  } catch (error) {
    console.error("Unexpected error unsaving event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id: eventId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if event exists
    const { data: eventExists, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      console.error("Error looking up event:", eventError);
      return NextResponse.json({ error: "Failed to verify event" }, { status: 500 });
    }

    if (!eventExists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Check if already saved
    const { data: existing, error: existingError } = await supabase
      .from("saved_events")
      .select("id")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingError) {
      console.error("Error checking saved event:", existingError);
      return NextResponse.json({ error: "Failed to check saved event" }, { status: 500 });
    }

    // Toggle: if already saved, unsave it
    if (existing) {
      const { error: deleteError } = await supabase
        .from("saved_events")
        .delete()
        .eq("user_id", user.id)
        .eq("event_id", eventId);

      if (deleteError) {
        console.error("Error unsaving event:", deleteError);
        return NextResponse.json({ error: "Failed to unsave event" }, { status: 500 });
      }

      return NextResponse.json({ saved: false });
    }

    // Save it
    const { error: insertError } = await supabase
      .from("saved_events")
      .insert({ user_id: user.id, event_id: eventId });

    if (insertError) {
      console.error("Save event error:", insertError);
      return NextResponse.json({ error: "Failed to save event" }, { status: 500 });
    }

    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Unexpected error saving event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/events/[id]/analytics
 * Returns event-level analytics: views, clicks, saves, RSVP breakdown.
 * Requires authentication and club membership.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch event to get club_id
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, event_date, club_id")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      return NextResponse.json(
        { error: "Failed to fetch event" },
        { status: 500 }
      );
    }

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!event.club_id) {
      return NextResponse.json(
        { error: "Event is not associated with a club" },
        { status: 400 }
      );
    }

    // Authorization: verify user is member of the event's club
    const { data: membership } = await supabase
      .from("club_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("club_id", event.club_id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "You must be a club member to view analytics" },
        { status: 403 }
      );
    }

    // Fetch popularity scores (may not exist for new events)
    const { data: popularity } = await supabase
      .from("event_popularity_scores")
      .select("view_count, click_count, save_count, unique_viewers")
      .eq("event_id", eventId)
      .maybeSingle();

    // Fetch RSVPs (exclude cancelled)
    const { data: rsvps } = await supabase
      .from("rsvps")
      .select("status")
      .eq("event_id", eventId)
      .neq("status", "cancelled");

    const rsvpList = rsvps ?? [];
    const rsvpGoing = rsvpList.filter(
      (r: { status: string }) => r.status === "going"
    ).length;
    const rsvpInterested = rsvpList.filter(
      (r: { status: string }) => r.status === "interested"
    ).length;

    // Fetch saved_events count (more accurate than popularity save_count)
    const { data: savedEvents } = await supabase
      .from("saved_events")
      .select("id")
      .eq("event_id", eventId);

    const saveCount = savedEvents?.length ?? 0;

    return NextResponse.json({
      event_id: event.id,
      title: event.title,
      event_date: event.event_date,
      views: popularity?.view_count ?? 0,
      clicks: popularity?.click_count ?? 0,
      saves: saveCount,
      unique_viewers: popularity?.unique_viewers ?? 0,
      rsvp_going: rsvpGoing,
      rsvp_interested: rsvpInterested,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

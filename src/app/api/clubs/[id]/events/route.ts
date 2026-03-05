import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface RsvpRow {
  event_id: string;
  status: string;
}

/**
 * GET /api/clubs/[id]/events
 * Returns approved events for public visitors.
 * Returns all events with RSVP counts for club organizers/members.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();

    // Check if the current user is a member of this club
    let isOrganizer = false;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: membership } = await supabase
        .from("club_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("club_id", clubId)
        .single();

      if (membership) {
        isOrganizer = true;
      }
    }

    // Build the query based on membership
    let query = supabase
      .from("events")
      .select("*, club:clubs(id, name, logo_url)")
      .eq("club_id", clubId)
      .order("start_date", { ascending: false });

    if (!isOrganizer) {
      query = query.eq("status", "approved");
    }

    const { data: events, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    const eventList = events ?? [];

    // For organizers, fetch RSVP counts
    if (isOrganizer && eventList.length > 0) {
      const eventIds = eventList.map((e) => e.id);

      const { data: rsvps } = await supabase
        .from("rsvps")
        .select("event_id, status")
        .in("event_id", eventIds);

      // Group counts by event_id and status
      const rsvpCounts: Record<string, { going: number; interested: number }> = {};
      if (rsvps) {
        for (const rsvp of rsvps as RsvpRow[]) {
          if (!rsvpCounts[rsvp.event_id]) {
            rsvpCounts[rsvp.event_id] = { going: 0, interested: 0 };
          }
          if (rsvp.status === "going") {
            rsvpCounts[rsvp.event_id].going++;
          } else if (rsvp.status === "interested") {
            rsvpCounts[rsvp.event_id].interested++;
          }
        }
      }

      // Attach rsvp_counts to each event
      const eventsWithRsvp = eventList.map((event) => ({
        ...event,
        rsvp_counts: rsvpCounts[event.id] || { going: 0, interested: 0 },
      }));

      return NextResponse.json({ events: eventsWithRsvp, isOrganizer: true });
    }

    return NextResponse.json({ events: eventList, isOrganizer: false });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

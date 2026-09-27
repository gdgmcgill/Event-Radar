import { NextRequest, NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireUser } from "@/server/authz/requireUser";
import { CLUB_ROLES, requireClubRole } from "@/server/authz/requireClubRole";
import { getElevatedClient } from "@/server/db/elevated";
import { logRouteError, withRoute } from "@/server/route";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/events/[id]/analytics
 * Returns event-level analytics: views, clicks, saves, RSVP breakdown.
 * Requires authentication and club membership.
 */
export const GET = withRoute({ cache: "private", action: "fetch event analytics" }, async (_request: NextRequest, { params }: RouteParams) => {
  try {
    const { id: eventId } = await params;
    const ctx = await createRequestContext();
    const auth = requireUser(ctx);
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const supabase = ctx.supabase;

    // Fetch event to get club_id
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, start_date, club_id")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      logRouteError(eventError);
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

    // Authorization: any member (owner or organizer) of the event's club
    const gate = await requireClubRole(
      supabase,
      event.club_id,
      user.id,
      CLUB_ROLES,
      "You must be a club member to view analytics"
    );
    if (!gate.ok) return gate.response;

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
    // Saves are private own-row data. After club authorization, count only
    // this event's saves; no saver identity leaves the database or response.
    const { count: saveCount, error: savesError } = await getElevatedClient()
      .from("saved_events")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    if (savesError) throw savesError;

    return NextResponse.json({
      event_id: event.id,
      title: event.title,
      start_date: event.start_date,
      views: popularity?.view_count ?? 0,
      clicks: popularity?.click_count ?? 0,
      saves: saveCount ?? 0,
      unique_viewers: popularity?.unique_viewers ?? 0,
      rsvp_going: rsvpGoing,
      rsvp_interested: rsvpInterested,
    });
  } catch (error) {
    logRouteError(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});

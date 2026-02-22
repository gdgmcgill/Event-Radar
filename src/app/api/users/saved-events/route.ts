/**
 * GET /api/users/saved-events
 * Retrieve all saved events for the authenticated user.
 * No user ID in the URL — derived from the auth session.
 *
 * Query parameters:
 *   sort - "recent" (default), "date", "title"
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import { transformEventFromDB } from "@/lib/tagMapping";

/**
 * @swagger
 * /api/users/saved-events:
 *   get:
 *     summary: Get saved events for the authenticated user
 *     description: Retrieve all events the current user has saved
 *     tags:
 *      - Users
 *     parameters:
 *       - name: sort
 *         description: Sort order - "recent" (saved date), "date" (event date), "title"
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           default: recent
 *     responses:
 *       200:
 *         description: Saved events retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Error retrieving user:", authError);
      return NextResponse.json(
        { error: "Failed to authenticate" },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sort = request.nextUrl.searchParams.get("sort") || "recent";

    // Step 1: Get saved event rows for this user
     
    const { data: savedRows, error: savedError } = await (supabase as any)
      .from("saved_events")
      .select("event_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (savedError) {
      console.error("Fetch saved events error:", savedError);
      return NextResponse.json(
        { error: "Failed to fetch saved events" },
        { status: 500 }
      );
    }

    if (!savedRows || savedRows.length === 0) {
      return NextResponse.json({ events: [], savedEventIds: [] });
    }

    // Build a map of event_id -> saved_at timestamp
     
    const savedAtMap = new Map<string, string>(
       
      savedRows.map((row: any) => [row.event_id, row.created_at])
    );
    const eventIds = Array.from(savedAtMap.keys());

    // Step 2: Fetch full event details (only approved events)
     
    const { data: eventsData, error: eventsError } = await (supabase as any)
      .from("events")
      .select("*")
      .in("id", eventIds)
      .eq("status", "approved");

    if (eventsError) {
      console.error("Fetch event details error:", eventsError);
      return NextResponse.json(
        { error: "Failed to fetch event details" },
        { status: 500 }
      );
    }

    // Transform events using shared utility and add saved_at
     
    const events = ((eventsData || []) as any[]).map((event: any) => ({
      ...transformEventFromDB(event),
      saved_at: savedAtMap.get(event.id),
    }));

    // Sort events
    if (sort === "date") {
      events.sort(
        (a, b) =>
          new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
      );
    } else if (sort === "title") {
      events.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      // "recent" — sort by saved_at descending (most recently saved first)
      events.sort(
        (a, b) =>
          new Date(b.saved_at || 0).getTime() -
          new Date(a.saved_at || 0).getTime()
      );
    }

    return NextResponse.json({
      events,
      savedEventIds: events.map((e) => e.id),
    });
  } catch (error) {
    console.error("Unexpected error fetching saved events:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

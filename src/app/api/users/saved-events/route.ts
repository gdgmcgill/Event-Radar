/**
 * GET /api/users/saved-events
 * Retrieve all saved events for the authenticated user.
 * No user ID in the URL — derived from the auth session.
 *
 * Query parameters:
 *   sort - "recent" (default), "date", "title"
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { EVENT_WITH_CLUB_SELECT, transformEventFromDB } from "@/lib/tagMapping";
import { createRequestContext } from "@/server/context";
import { requireUser } from "@/server/authz/requireUser";
import { serverError } from "@/server/errors";
import { ok } from "@/server/http";
import { readQuery } from "@/server/body";
import { SavedEventsQuery } from "@/contracts/users";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";
import { getESTNowISO } from "@/lib/timezone";

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
export const GET = withRoute({ cache: "private", action: "fetch saved events" }, async (request: NextRequest) => {
  try {
    const ctx = await createRequestContext();

    // Missing/invalid session is an authorization failure, not a server failure.
    const auth = requireUser(ctx);
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const supabase = ctx.supabase;

    // sort defaults to "recent"; include_past is exactly "true". No 400.
    const { sort, include_past: includePast } = readQuery(
      request.nextUrl.searchParams,
      SavedEventsQuery
    );

    // Step 1: Get saved event rows for this user
     
    const { data: savedRows, error: savedError } = await supabase
      .from("saved_events")
      .select("event_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (savedError) {
      log.error("Fetch saved events error", { error: savedError });
      return serverError("fetch saved events");
    }

    if (!savedRows || savedRows.length === 0) {
      return ok({ events: [], savedEventIds: [] });
    }

    // Build a map of event_id -> saved_at timestamp
     
    const savedAtMap = new Map<string, string>(
       
      savedRows.map((row: any) => [row.event_id, row.created_at])
    );
    const eventIds = Array.from(savedAtMap.keys());

    // Step 2: Fetch full event details (only approved, non-past events)
    let eventsQuery = supabase
      .from("events")
      .select(EVENT_WITH_CLUB_SELECT)
      .in("id", eventIds)
      .eq("status", "approved")
      .is("deleted_at", null);

    // start_date is Eastern wall-clock stored with a +00 offset, so "now" is
    // expressed the same way: the floor /api/events uses (F-085).
    if (!includePast) {
      eventsQuery = eventsQuery.gte("start_date", getESTNowISO());
    }

    const { data: eventsData, error: eventsError } = await eventsQuery;

    if (eventsError) {
      log.error("Fetch event details error", { error: eventsError });
      return serverError("fetch event details");
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
          new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
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

    return ok({
      events,
      savedEventIds: events.map((e) => e.id),
    });
  } catch (error) {
    log.error("Unexpected error fetching saved events", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});

/**
 * GET /api/events/:id - Fetch a single event by ID
 * PATCH /api/events/:id - Edit an event (role-based permissions)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transformEventFromDB } from "@/lib/tagMapping";
import type { NextRequest } from "next/server";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *    summary: /api/events/{id}
 *    description: Fetch a single event by ID
 *    tags:
 *      - Events
 *    parameters:
 *      - name: id
 *        description: Event ID
 *        in: path
 *        required: true
 *        schema:
 *          type: string
 *    responses:
 *      200:
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                event:
 *                  type: object
 *                  properties:
 *                    id:
 *                      type: string
 *                    title:
 *                      type: string
 *                    description:
 *                      type: string
 *                    event_date:
 *                      type: string
 *                    event_time:
 *                      type: string
 *                    location:
 *                      type: string
 *                    club_id:
 *                      type: string
 *                    tags:
 *                      type: array
 *                      items:
 *                        type: string
 *                    image_url:
 *                      type: string
 *                    status:
 *                      type: string
 *                    approved_by:
 *                      type: string
 *                    approved_at:
 *                      type: string
 *        description: Event fetched successfully
 *      404:
 *        description: Event not found
 *      500:
 *        description: Internal server error
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Fetch event without club relation since Clubs table does not exist
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Supabase error fetching event:", error);
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Event not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Transform event to frontend format (cast needed: clubs relation may not exist in DB types)
    const event = transformEventFromDB(data as unknown as Parameters<typeof transformEventFromDB>[0]);

    return NextResponse.json({ event });
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}

const EDITABLE_FIELDS = [
  "title",
  "description",
  "start_date",
  "end_date",
  "location",
  "tags",
  "image_url",
  "category",
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verify authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be signed in to edit an event" },
        { status: 401 }
      );
    }

    // Fetch the event to check ownership / club
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, club_id")
      .eq("id", id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Get user roles
    const { data: profile } = await supabase
      .from("users")
      .select("roles")
      .eq("id", user.id)
      .single();

    const roles: string[] = profile?.roles ?? [];

    // Permission check: admin can edit any event
    let canEdit = roles.includes("admin");

    // Club organizer can edit their own club's events
    if (!canEdit && roles.includes("club_organizer") && event.club_id) {
      const { data: membership } = await supabase
        .from("club_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("club_id", event.club_id)
        .single();

      if (membership) {
        canEdit = true;
      }
    }

    if (!canEdit) {
      return NextResponse.json(
        { error: "You do not have permission to edit this event" },
        { status: 403 }
      );
    }

    // Build update payload from allowed fields only
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("events")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating event:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ event: data });
  } catch (error) {
    console.error("Error in edit event:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}

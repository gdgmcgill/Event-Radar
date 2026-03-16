/**
 * GET /api/events/:id - Fetch a single event by ID
 * PATCH /api/events/:id - Edit an event (role-based permissions)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transformEventFromDB } from "@/lib/tagMapping";
import type { NextRequest } from "next/server";
import { validateEventDates, isValidISODate } from "@/lib/dateValidation";

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
 *                    start_date:
 *                      type: string
 *                    end_date:
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
      .is("deleted_at", null)
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
    const event = transformEventFromDB(data as Parameters<typeof transformEventFromDB>[0]);

    // Strip pending_edits from public responses — only show to creator or admins
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser || data.created_by !== currentUser.id) {
      let isAdmin = false;
      if (currentUser) {
        const { data: profile } = await supabase
          .from("users")
          .select("roles")
          .eq("id", currentUser.id)
          .single();
        isAdmin = (profile?.roles ?? []).includes("admin");
      }
      if (!isAdmin) {
        const { pending_edits: _, ...eventWithoutPending } = event as unknown as Record<string, unknown>;
        return NextResponse.json({ event: eventWithoutPending });
      }
    }

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
  "is_free",
  "price",
  "rsvp_link",
] as const;

const MODERATED_FIELDS = ["title", "image_url"] as const;

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
      .select("id, club_id, created_by, status, pending_edits")
      .eq("id", id)
      .is("deleted_at", null)
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
    const isAdmin = roles.includes("admin");
    let canEdit = isAdmin;

    // Original creator can edit their own pending or approved events
    if (!canEdit && event.created_by === user.id) {
      if (event.status === "pending" || event.status === "approved") {
        canEdit = true;
      } else if (event.status === "rejected") {
        return NextResponse.json(
          { error: "Rejected events cannot be edited. Please use the appeal process." },
          { status: 403 }
        );
      }
    }

    // Club member can edit their club's events
    let isClubMember = false;
    if (!canEdit && event.club_id) {
      const { data: membership } = await supabase
        .from("club_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("club_id", event.club_id)
        .single();

      if (membership) {
        canEdit = true;
        isClubMember = true;
      }
    } else if (canEdit && event.club_id) {
      const { data: membership } = await supabase
        .from("club_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("club_id", event.club_id)
        .single();
      isClubMember = !!membership;
    }

    if (!canEdit) {
      return NextResponse.json(
        { error: "You do not have permission to edit this event" },
        { status: 403 }
      );
    }

    // Build update payload from allowed fields only
    const body = await request.json();
    const directUpdates: Record<string, unknown> = {};
    const pendingEdits: Record<string, string> = {};

    for (const field of EDITABLE_FIELDS) {
      if (!(field in body)) continue;

      const needsModeration =
        !isAdmin &&
        !(isClubMember && event.created_by === user.id) &&
        event.status === "approved" &&
        (MODERATED_FIELDS as readonly string[]).includes(field);

      if (needsModeration) {
        pendingEdits[field] = body[field];
      } else {
        directUpdates[field] = body[field];
      }
    }

    // If admin directly edits title or image_url, clear pending_edits
    if (isAdmin) {
      const adminEditedModeratedField = MODERATED_FIELDS.some(
        (f) => f in body
      );
      if (adminEditedModeratedField) {
        directUpdates.pending_edits = null;
      }
    }

    if (Object.keys(directUpdates).length === 0 && Object.keys(pendingEdits).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Validate date fields when present in the direct update payload
    if ("start_date" in directUpdates) {
      const dateError = validateEventDates(
        directUpdates.start_date,
        "end_date" in directUpdates ? directUpdates.end_date : undefined
      );
      if (dateError) {
        return NextResponse.json(
          { error: dateError.message, field: dateError.field },
          { status: 400 }
        );
      }
    } else if ("end_date" in directUpdates) {
      if (!isValidISODate(directUpdates.end_date)) {
        return NextResponse.json(
          {
            error: 'end_date must be a valid ISO 8601 date (e.g. "2026-03-15" or "2026-03-15T11:00:00Z")',
            field: "end_date",
          },
          { status: 400 }
        );
      }
    }

    // Write pending edits if any — merge with existing pending edits
    if (Object.keys(pendingEdits).length > 0) {
      const existingPending = (event.pending_edits as Record<string, unknown>) ?? {};
      directUpdates.pending_edits = {
        ...existingPending,
        ...pendingEdits,
        submitted_at: new Date().toISOString(),
      };
    }

    const { data, error } = await supabase
      .from("events")
      .update(directUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating event:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const hasPendingEdits = Object.keys(pendingEdits).length > 0;
    return NextResponse.json({
      event: data,
      message: hasPendingEdits
        ? "Some changes require admin approval before going live"
        : "Event updated successfully",
      pending_fields: hasPendingEdits ? Object.keys(pendingEdits).filter(k => k !== "submitted_at") : [],
    });
  } catch (error) {
    console.error("Error in edit event:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch event
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, created_by, club_id")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Permission: creator OR admin OR club member
    let canDelete = event.created_by === user.id;

    if (!canDelete) {
      const { data: profile } = await supabase
        .from("users")
        .select("roles")
        .eq("id", user.id)
        .single();
      canDelete = (profile?.roles ?? []).includes("admin");
    }

    if (!canDelete && event.club_id) {
      const { data: membership } = await supabase
        .from("club_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("club_id", event.club_id)
        .single();
      canDelete = !!membership;
    }

    if (!canDelete) {
      return NextResponse.json({ error: "You do not have permission to delete this event" }, { status: 403 });
    }

    const { error } = await supabase
      .from("events")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}

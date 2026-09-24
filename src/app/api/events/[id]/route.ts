/**
 * GET /api/events/:id - Fetch a single event by ID
 * PATCH /api/events/:id - Edit an event (role-based permissions)
 */

import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { CLUB_ROLES, requireClubRole } from "@/server/authz/requireClubRole";
import { hasRole } from "@/lib/roles";
import type { TablesUpdate } from "@/lib/supabase/types";
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
    const ctx = await createRequestContext();
    const supabase = ctx.supabase;

    // Deliberately no club embed yet. The clubs table exists and the list
    // routes embed it (EVENT_WITH_CLUB_SELECT). Giving this read the embed
    // would change what every seeded detail page renders under "Hosted by",
    // from the organizer label to the real club. That is F-080's gated half,
    // decided at the 04-11 owner checkpoint (DEC-27). Until then the
    // transform's organizer fallback supplies `club` here.
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

    // pending_edits reaches the event's creator and admins only (F-086,
    // DEC-53). The shared transform does not copy the column and is not
    // changed here, so the list routes are unaffected; the row's value is
    // attached after it, when there is one (a row without pending edits
    // answers exactly as before). Everyone else gets the event without the
    // key, even if a future transform carries it.
    const isCreator = ctx.user !== null && data.created_by === ctx.user.id;
    const isAdmin = ctx.profile !== null && hasRole(ctx.profile, "admin");
    if (isCreator || isAdmin) {
      return NextResponse.json({
        event:
          data.pending_edits != null
            ? { ...event, pending_edits: data.pending_edits }
            : event,
      });
    }

    const { pending_edits: _omitted, ...publicEvent } =
      event as unknown as Record<string, unknown>;
    return NextResponse.json({ event: publicEvent });
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
    const ctx = await createRequestContext();

    // Keeps this arm's own anonymous bytes (DEC-34).
    if (!ctx.user) {
      return NextResponse.json(
        { error: "You must be signed in to edit an event" },
        { status: 401 }
      );
    }

    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    const { id } = await params;

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

    // Permission check: admin can edit any event. The roles come from the
    // request context's profile read, the one role predicate decides.
    const isAdmin = ctx.profile !== null && hasRole(ctx.profile, "admin");
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

    // Club member (owner or organizer) can edit their club's events
    let isClubMember = false;
    if (!canEdit && event.club_id) {
      const membership = await requireClubRole(
        supabase,
        event.club_id,
        user.id,
        CLUB_ROLES
      );

      if (membership.ok) {
        canEdit = true;
        isClubMember = true;
      }
    } else if (canEdit && event.club_id) {
      isClubMember = (
        await requireClubRole(supabase, event.club_id, user.id, CLUB_ROLES)
      ).ok;
    }

    if (!canEdit) {
      return NextResponse.json(
        { error: "You do not have permission to edit this event" },
        { status: 403 }
      );
    }

    // Build update payload from allowed fields only
    const body = await request.json();
    // DI-25: typed with the generated update type. The body's values are
    // carried as they arrive; the column set is EDITABLE_FIELDS plus
    // pending_edits, all of which are columns of events.
    const directUpdates: TablesUpdate<"events"> = {};
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
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    const { id } = await params;

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

    // Permission: creator OR admin OR club member (owner or organizer)
    let canDelete = event.created_by === user.id;

    if (!canDelete) {
      canDelete = ctx.profile !== null && hasRole(ctx.profile, "admin");
    }

    if (!canDelete && event.club_id) {
      canDelete = (
        await requireClubRole(supabase, event.club_id, user.id, CLUB_ROLES)
      ).ok;
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

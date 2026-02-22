/**
 * /api/events/:id/rsvp
 *
 * GET  – Retrieve RSVP counts for an event + current user's RSVP status
 * POST – Create or update an RSVP for the authenticated user
 * DELETE – Cancel / remove an RSVP for the authenticated user
 *
 * Testing without auth (before auth is implemented):
 *   Same approach as /api/events/:id/save – see that file for instructions.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

const VALID_STATUSES = ["going", "interested"] as const;
type RsvpStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(status: unknown): status is RsvpStatus {
  return typeof status === "string" && VALID_STATUSES.includes(status as RsvpStatus);
}

// ─── GET /api/events/:id/rsvp ───────────────────────────────────────────────
/**
 * @swagger
 * /api/events/{id}/rsvp:
 *   get:
 *     summary: Get RSVP info for an event
 *     description: Returns RSVP counts and the current user's RSVP status (if authenticated)
 *     tags:
 *       - RSVP
 *     parameters:
 *       - name: id
 *         description: Event ID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: RSVP info retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 counts:
 *                   type: object
 *                   properties:
 *                     going:
 *                       type: number
 *                     interested:
 *                       type: number
 *                     total:
 *                       type: number
 *                 user_rsvp:
 *                   type: object
 *                   nullable: true
 *       404:
 *         description: Event not found
 *       500:
 *         description: Internal server error
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id: eventId } = await params;
    const supabase = await createClient();

    // Verify event exists
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

    // Get RSVP counts (exclude cancelled)
    const { data: rsvps, error: rsvpError } = await supabase
      .from("rsvps")
      .select("id, status")
      .eq("event_id", eventId)
      .neq("status", "cancelled");

    if (rsvpError) {
      console.error("Error fetching RSVPs:", rsvpError);
      return NextResponse.json({ error: "Failed to fetch RSVPs" }, { status: 500 });
    }

    const goingCount = rsvps?.filter((r) => r.status === "going").length ?? 0;
    const interestedCount = rsvps?.filter((r) => r.status === "interested").length ?? 0;

    // Check current user's RSVP (if authenticated)
    let userRsvp = null;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: existingRsvp } = await supabase
        .from("rsvps")
        .select("id, status, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("event_id", eventId)
        .neq("status", "cancelled")
        .maybeSingle();

      userRsvp = existingRsvp ?? null;
    }

    return NextResponse.json({
      counts: {
        going: goingCount,
        interested: interestedCount,
        total: goingCount + interestedCount,
      },
      user_rsvp: userRsvp,
    });
  } catch (error) {
    console.error("Unexpected error fetching RSVPs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/events/:id/rsvp ──────────────────────────────────────────────
/**
 * @swagger
 * /api/events/{id}/rsvp:
 *   post:
 *     summary: RSVP to an event
 *     description: Create or update an RSVP for the authenticated user
 *     tags:
 *       - RSVP
 *     parameters:
 *       - name: id
 *         description: Event ID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - status
 *             properties:
 *               user_id:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [going, interested]
 *     responses:
 *       201:
 *         description: RSVP created
 *       200:
 *         description: RSVP updated
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: user_id does not match authenticated user
 *       404:
 *         description: Event not found
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id: eventId } = await params;
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Error retrieving user:", authError);
      return NextResponse.json({ error: "Failed to authenticate" }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { user_id: userIdFromBody, status } = body as {
      user_id?: string;
      status?: string;
    };

    // Validate user_id
    if (!userIdFromBody) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    if (userIdFromBody !== user.id) {
      return NextResponse.json(
        { error: "user_id does not match authenticated user" },
        { status: 403 }
      );
    }

    // Validate status
    if (!status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    if (!isValidStatus(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify event exists
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

    // Check for existing RSVP
    const { data: existingRsvp, error: existingError } = await supabase
      .from("rsvps")
      .select("id, status, created_at")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingError) {
      console.error("Error checking existing RSVP:", existingError);
      return NextResponse.json(
        { error: "Failed to check existing RSVP" },
        { status: 500 }
      );
    }

    // Update existing RSVP
    if (existingRsvp) {
      if (existingRsvp.status === status) {
        return NextResponse.json(
          { message: `Already RSVP'd as ${status}`, rsvp: existingRsvp },
          { status: 200 }
        );
      }

      const { data: updatedRsvp, error: updateError } = await supabase
        .from("rsvps")
        .update({ status })
        .eq("id", existingRsvp.id)
        .select("id, status, created_at, updated_at")
        .single();

      if (updateError) {
        console.error("Error updating RSVP:", updateError);
        return NextResponse.json({ error: "Failed to update RSVP" }, { status: 500 });
      }

      return NextResponse.json(
        { success: true, message: `RSVP updated to ${status}`, rsvp: updatedRsvp },
        { status: 200 }
      );
    }

    // Create new RSVP
    const { data: newRsvp, error: insertError } = await supabase
      .from("rsvps")
      .insert({
        user_id: user.id,
        event_id: eventId,
        status,
      })
      .select("id, status, created_at, updated_at")
      .single();

    if (insertError) {
      console.error("Error creating RSVP:", insertError);
      return NextResponse.json({ error: "Failed to create RSVP" }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, message: `RSVP'd as ${status}`, rsvp: newRsvp },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error creating RSVP:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE /api/events/:id/rsvp ────────────────────────────────────────────
/**
 * @swagger
 * /api/events/{id}/rsvp:
 *   delete:
 *     summary: Cancel RSVP
 *     description: Cancel the authenticated user's RSVP for an event
 *     tags:
 *       - RSVP
 *     parameters:
 *       - name: id
 *         description: Event ID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *             properties:
 *               user_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: RSVP cancelled
 *       400:
 *         description: Missing user_id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: user_id does not match authenticated user
 *       404:
 *         description: No RSVP found
 *       500:
 *         description: Internal server error
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { id: eventId } = await params;
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Error retrieving user:", authError);
      return NextResponse.json({ error: "Failed to authenticate" }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const userIdFromBody = (body as { user_id?: string }).user_id;

    if (!userIdFromBody) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    if (userIdFromBody !== user.id) {
      return NextResponse.json(
        { error: "user_id does not match authenticated user" },
        { status: 403 }
      );
    }

    // Soft-delete: set status to 'cancelled'
    const { data: existingRsvp, error: findError } = await supabase
      .from("rsvps")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .neq("status", "cancelled")
      .maybeSingle();

    if (findError) {
      console.error("Error finding RSVP:", findError);
      return NextResponse.json({ error: "Failed to find RSVP" }, { status: 500 });
    }

    if (!existingRsvp) {
      return NextResponse.json({ error: "No active RSVP found for this event" }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from("rsvps")
      .update({ status: "cancelled" })
      .eq("id", existingRsvp.id);

    if (updateError) {
      console.error("Error cancelling RSVP:", updateError);
      return NextResponse.json({ error: "Failed to cancel RSVP" }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, message: "RSVP cancelled" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error cancelling RSVP:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
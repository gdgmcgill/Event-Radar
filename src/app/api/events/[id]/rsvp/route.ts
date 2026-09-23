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
import { checkBanStatus } from "@/lib/ban";
import { createRequestContext } from "@/server/context";
import { requireUser } from "@/server/authz/requireUser";
import { badRequest, forbidden, notFound, serverError } from "@/server/errors";
import { created, ok } from "@/server/http";
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
    // Anonymous-tolerant: no requireUser. ctx.user is read below for user_rsvp.
    const ctx = await createRequestContext();
    const supabase = ctx.supabase;

    // Verify event exists
    const { data: eventExists, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .is("deleted_at", null)
      .maybeSingle();

    if (eventError) {
      console.error("Error looking up event:", eventError);
      return serverError("verify event");
    }

    if (!eventExists) {
      return notFound("Event not found");
    }

    // Get RSVP counts (exclude cancelled)
    const { data: rsvps, error: rsvpError } = await supabase
      .from("rsvps")
      .select("id, status")
      .eq("event_id", eventId)
      .neq("status", "cancelled");

    if (rsvpError) {
      console.error("Error fetching RSVPs:", rsvpError);
      return serverError("fetch RSVPs");
    }

    const goingCount = rsvps?.filter((r) => r.status === "going").length ?? 0;
    const interestedCount = rsvps?.filter((r) => r.status === "interested").length ?? 0;

    // Check current user's RSVP (if authenticated)
    let userRsvp = null;
    const user = ctx.user;

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

    return ok({
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
    const banResponse = await checkBanStatus();
    if (banResponse) return banResponse;

    const { id: eventId } = await params;
    const ctx = await createRequestContext();

    // Authenticate user
    const auth = requireUser(ctx);
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const supabase = ctx.supabase;

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid JSON body");
    }

    const { user_id: userIdFromBody, status } = body as {
      user_id?: string;
      status?: string;
    };

    // Validate user_id
    if (!userIdFromBody) {
      return badRequest("user_id is required");
    }

    if (userIdFromBody !== user.id) {
      return forbidden("user_id does not match authenticated user");
    }

    // Validate status
    if (!status) {
      return badRequest("status is required");
    }

    if (!isValidStatus(status)) {
      return badRequest(
        `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`
      );
    }

    // Verify event exists
    const { data: eventExists, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .is("deleted_at", null)
      .maybeSingle();

    if (eventError) {
      console.error("Error looking up event:", eventError);
      return serverError("verify event");
    }

    if (!eventExists) {
      return notFound("Event not found");
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
      return serverError("check existing RSVP");
    }

    // Update existing RSVP
    if (existingRsvp) {
      if (existingRsvp.status === status) {
        return ok({ message: `Already RSVP'd as ${status}`, rsvp: existingRsvp });
      }

      const { data: updatedRsvp, error: updateError } = await supabase
        .from("rsvps")
        .update({ status })
        .eq("id", existingRsvp.id)
        .select("id, status, created_at, updated_at")
        .single();

      if (updateError) {
        console.error("Error updating RSVP:", updateError);
        return serverError("update RSVP");
      }

      return ok({
        success: true,
        message: `RSVP updated to ${status}`,
        rsvp: updatedRsvp,
      });
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
      return serverError("create RSVP");
    }

    return created({ success: true, message: `RSVP'd as ${status}`, rsvp: newRsvp });
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
    const ctx = await createRequestContext();

    // Authenticate user
    const auth = requireUser(ctx);
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const supabase = ctx.supabase;

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const userIdFromBody = (body as { user_id?: string }).user_id;

    if (!userIdFromBody) {
      return badRequest("user_id is required");
    }

    if (userIdFromBody !== user.id) {
      return forbidden("user_id does not match authenticated user");
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
      return serverError("find RSVP");
    }

    if (!existingRsvp) {
      return notFound("No active RSVP found for this event");
    }

    const { error: updateError } = await supabase
      .from("rsvps")
      .update({ status: "cancelled" })
      .eq("id", existingRsvp.id);

    if (updateError) {
      console.error("Error cancelling RSVP:", updateError);
      return serverError("cancel RSVP");
    }

    return ok({ success: true, message: "RSVP cancelled" });
  } catch (error) {
    console.error("Unexpected error cancelling RSVP:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
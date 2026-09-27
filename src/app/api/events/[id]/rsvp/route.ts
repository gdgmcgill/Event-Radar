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
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { forbidden, notFound, serverError } from "@/server/errors";
import { parseBody, parseWith } from "@/server/body";
import { RsvpBody, RsvpDeleteBody, RsvpStatus } from "@/contracts/events";
import { created, ok } from "@/server/http";
import type { NextRequest } from "next/server";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
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
export const GET = withRoute({ cache: "private", action: "fetch RSVPs" }, async (_request: NextRequest, { params }: RouteContext) => {
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
      log.error("Error looking up event", { error: eventError });
      return serverError("verify event");
    }

    if (!eventExists) {
      return notFound("Event not found");
    }

    // Public counts are a narrow aggregate; attendance rows are private (F-011).
    // The database counts all matching rows, avoiding PostgREST's row cap (F-079).
    const { data: counts, error: rsvpError } = await supabase.rpc(
      "get_public_event_rsvp_counts", { target_event_id: eventId }
    );
    if (rsvpError) {
      log.error("Error fetching RSVPs", { error: rsvpError });
      return serverError("fetch RSVPs");
    }
    const goingCount = counts?.[0]?.going ?? 0;
    const interestedCount = counts?.[0]?.interested ?? 0;

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
    log.error("Unexpected error fetching RSVPs", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

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
export const POST = withRoute({ cache: "private", action: "create RSVP" }, async (request: NextRequest, { params }: RouteContext) => {
  try {
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    const { id: eventId } = await params;

    // The contract (plan 06-08, REFAC-15): user_id first, then the handler's
    // mismatch 403, then the status rules, in today's order. F-094: a non-
    // object body is a 400 (INTENTIONAL BEHAVIOUR CHANGE).
    const parsed = await parseBody(request, RsvpBody);
    if (!parsed.ok) return parsed.response;

    if (parsed.data.user_id !== user.id) {
      return forbidden("user_id does not match authenticated user");
    }

    const statusParsed = parseWith(RsvpStatus, parsed.data.status);
    if (!statusParsed.ok) return statusParsed.response;
    const status = statusParsed.data;

    // Verify event exists
    const { data: eventExists, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .is("deleted_at", null)
      .maybeSingle();

    if (eventError) {
      log.error("Error looking up event", { error: eventError });
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
      log.error("Error checking existing RSVP", { error: existingError });
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
        log.error("Error updating RSVP", { error: updateError });
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
      log.error("Error creating RSVP", { error: insertError });
      return serverError("create RSVP");
    }

    return created({ success: true, message: `RSVP'd as ${status}`, rsvp: newRsvp });
  } catch (error) {
    log.error("Unexpected error creating RSVP", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

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
export const DELETE = withRoute({ cache: "private", action: "cancel RSVP" }, async (request: NextRequest, { params }: RouteContext) => {
  try {
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    const { id: eventId } = await params;

    // The contract (plan 06-08, REFAC-15). F-094: a body that is not JSON
    // answers 400 "Invalid JSON body" (it was read as {} and answered
    // "user_id is required"), a non-object body 400 "Request body must be a
    // JSON object" (INTENTIONAL BEHAVIOUR CHANGE).
    const parsed = await parseBody(request, RsvpDeleteBody);
    if (!parsed.ok) return parsed.response;

    if (parsed.data.user_id !== user.id) {
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
      log.error("Error finding RSVP", { error: findError });
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
      log.error("Error cancelling RSVP", { error: updateError });
      return serverError("cancel RSVP");
    }

    return ok({ success: true, message: "RSVP cancelled" });
  } catch (error) {
    log.error("Unexpected error cancelling RSVP", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
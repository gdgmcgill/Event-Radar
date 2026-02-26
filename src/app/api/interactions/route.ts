/**
 * POST /api/interactions
 * Track user interactions with events
 *
 * Supports both authenticated and anonymous users.
 * Anonymous interactions are tracked with user_id = null.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TrackInteractionPayload } from "@/types";
import { validationError, notFoundError, internalError } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";

/**
 * @swagger
 * /api/interactions:
 *   post:
 *     summary: Track a user interaction with an event
 *     description: Records user interactions for analytics and recommendations
 *     tags:
 *       - Tracking
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event_id
 *               - interaction_type
 *             properties:
 *               event_id:
 *                 type: string
 *                 format: uuid
 *               interaction_type:
 *                 type: string
 *                 enum: [view, click, save, unsave, share, calendar_add]
 *               source:
 *                 type: string
 *                 enum: [home, search, recommendation, calendar, direct, modal]
 *               session_id:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Interaction recorded successfully
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const body: TrackInteractionPayload = await request.json();

    // Validate required fields
    if (!body.event_id || !body.interaction_type) {
      return validationError("event_id and interaction_type are required");
    }

    // Validate interaction_type
    const validTypes = ['view', 'click', 'save', 'unsave', 'share', 'calendar_add'];
    if (!validTypes.includes(body.interaction_type)) {
      return validationError(`Invalid interaction_type. Must be one of: ${validTypes.join(", ")}`);
    }

    // Validate source if provided (must match user_interactions.source CHECK constraint)
    const validSources = ['home', 'search', 'recommendation', 'calendar', 'direct', 'modal', 'my-events'];
    if (body.source && !validSources.includes(body.source)) {
      return validationError(`Invalid source. Must be one of: ${validSources.join(", ")}`);
    }

    const supabase = await createClient();

    // Get current user (optional - anonymous tracking supported)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Verify the event exists
    const { data: eventExists, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("id", body.event_id)
      .maybeSingle();

    if (eventError) {
      logger.error("Failed to verify event", eventError, { eventId: body.event_id });
      return internalError("Failed to verify event");
    }

    if (!eventExists) {
      return notFoundError("Event");
    }

    // Insert the interaction
    // Using type assertion since the new tables aren't in generated types yet
    const interactionData = {
      user_id: user?.id || null,
      event_id: body.event_id,
      interaction_type: body.interaction_type,
      source: body.source || null,
      session_id: body.session_id || null,
      metadata: body.metadata || {},
    };

    const { data: interaction, error: insertError } = await supabase
      .from("user_interactions")
      .insert(interactionData as never)
      .select("id, created_at")
      .single();

    if (insertError) {
      logger.error("Failed to record interaction", insertError, { eventId: body.event_id });
      return internalError("Failed to record interaction");
    }

    const result = interaction as { id: string; created_at: string } | null;

    return NextResponse.json(
      {
        success: true,
        interaction_id: result?.id,
        recorded_at: result?.created_at,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Unexpected error recording interaction", error);
    return internalError();
  }
}

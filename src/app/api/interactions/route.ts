/**
 * POST /api/interactions
 * Track user interactions with events
 *
 * Supports both authenticated and anonymous users.
 * Anonymous interactions are tracked with user_id = null.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { parseBody } from "@/server/body";
import { InteractionBody } from "@/contracts/interactions";

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
    // Anonymous tracking stays open (DEC-34): the guards apply only when a
    // user is present.
    const ctx = await createRequestContext();
    if (ctx.user) {
      const active = requireActiveUser(ctx);
      if (!active.ok) return active.response;
      const onboarded = requireOnboarded(ctx);
      if (!onboarded.ok) return onboarded.response;
    }
    const user = ctx.user;
    const supabase = ctx.supabase;

    // The contract carries today's three 400s in today's order: presence of
    // event_id and interaction_type, the interaction_type list, then the
    // source list (user_interactions.source CHECK constraint). A body that is
    // not a JSON object answers 400 instead of 500 (F-094).
    const parsed = await parseBody(request, InteractionBody);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // Verify the event exists
    const { data: eventExists, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("id", body.event_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (eventError) {
      console.error("Error verifying event:", eventError);
      return NextResponse.json(
        { error: "Failed to verify event" },
        { status: 500 }
      );
    }

    if (!eventExists) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
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
      console.error("Error recording interaction:", insertError);
      return NextResponse.json(
        { error: "Failed to record interaction" },
        { status: 500 }
      );
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
    console.error("Unexpected error recording interaction:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

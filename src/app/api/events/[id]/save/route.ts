/**
 * POST /api/events/:id/save
 * Persist a saved event entry for the authenticated user.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: {
    id: string;
  };
}

type UserSavedEventRow = Database["public"]["Tables"]["saved_events"]["Row"];

/**
 * @swagger
 * /api/events/{id}/save:
 *   post:
 *     summary: Save an event for the current user
 *     description: Persist a saved event entry for the authenticated user
 *     tags:
 *      - Events
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
 *             properties:
 *               user_id:
 *                 type: string
 *                 description: The authenticated user's ID
 *     responses:
 *       201:
 *         description: Event saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 saved_at:
 *                   type: string
 *       200:
 *         description: Event already saved
 *       400:
 *         description: Missing user_id
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
    const supabase = await createClient();
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
      return NextResponse.json({ error: "user_id does not match authenticated user" }, { status: 403 });
    }

    const eventId = params.id;

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

    const { data: existingData, error: existingError } = await supabase
      .from("saved_events")
      .select("id, created_at")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingError) {
      console.error("Error checking saved event:", existingError);
      return NextResponse.json(
        { error: "Failed to check saved event" },
        { status: 500 }
      );
    }

    const existing = existingData as UserSavedEventRow | null;

    if (existing) {
      return NextResponse.json(
        { message: "Event already saved", saved_at: existing.created_at },
        { status: 200 }
      );
    }

    const { data: insertedData, error: insertError } = await supabase
      .from("saved_events")
      .insert({
        user_id: user.id,
        event_id: eventId,
      })
      .select("created_at")
      .single();

    if (insertError) {
      console.error("Save event error:", insertError);
      return NextResponse.json(
        { error: "Failed to save event" },
        { status: 500 }
      );
    }

    const savedRecord = insertedData as UserSavedEventRow;

    return NextResponse.json(
      { success: true, saved_at: savedRecord.created_at },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error saving event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

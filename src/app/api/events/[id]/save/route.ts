/**
 * POST /api/events/:id/save
 * Persist a saved event entry for the authenticated user.
 *
 * Testing without auth (before auth is implemented):
 * 1. Uncomment service role client lines below (lines 37-41) and comment out line 33
 * 2. Ensure SUPABASE_SERVICE_ROLE_KEY is in .env.local
 * 3. Create test.json: @"{"user_id":"<valid-user-id>"}"@ | Out-File -Encoding utf8 -NoNewline test.json
 * 4. Run: curl.exe "http://localhost:3000/api/events/<event-id>/save" -X POST -H "Content-Type: application/json" -d "@test.json"
 * 5. Re-comment service role lines before committing
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
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
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { id: eventId } = await params;
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
    if (userIdFromBody && userIdFromBody !== user.id) {
      return NextResponse.json({ error: "user_id does not match authenticated user" }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from("saved_events")
      .delete()
      .eq("user_id", user.id)
      .eq("event_id", eventId);

    if (deleteError) {
      console.error("Error deleting saved event:", deleteError);
      return NextResponse.json({ error: "Failed to unsave event" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error unsaving event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id: eventId } = await params;
    const supabase = await createClient();

    // For testing without auth, uncomment below and comment out line above:
    // const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    // const supabase = createSupabaseClient(
    //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
    //   process.env.SUPABASE_SERVICE_ROLE_KEY!
    // );

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

    const insertPayload: Database["public"]["Tables"]["saved_events"]["Insert"] = {
      user_id: user.id,
      event_id: eventId,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedData, error: insertError } = await (supabase as any)
      .from("saved_events")
      .insert(insertPayload)
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


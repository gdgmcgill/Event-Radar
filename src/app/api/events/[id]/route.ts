/**
 * GET /api/events/:id
 * Fetch a single event by ID with club relation
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

    // Fetch event (without join — matches list route behaviour)
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

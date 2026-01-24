/**
 * GET /api/recommendations
 * Get personalized event recommendations for the current user
 * TODO: Implement recommendation algorithm based on user interests and past events
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const FLASK_BASE_URL = process.env.FLASK_BASE_URL || "http://localhost:5000";
const SAMPLE_USER_TAGS = ["academic", "wellness"]; // TODO: replace with logged-in user's interest tags

/**
 * @swagger
 * /api/recommendations:
 *   get:
 *    summary: Get personalized event recommendations
 *    description: Returns events scored by cosine similarity against the user's interest tags (sample tags used when unauthenticated).
 *    tags:
 *      - Recommendations
 *    responses:
 *      200:
 *        description: Recommendations fetched successfully
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                recommendations:
 *                  type: array
 *                  items:
 *                    type: object
 *                    properties:
 *                      id:
 *                        type: string
 *                      title:
 *                        type: string
 *                      description:
 *                        type: string
 *                      event_date:
 *                        type: string
 *                      event_time:
 *                        type: string
 *                      location:
 *                        type: string
 *                      club_id:
 *                        type: string
 *                      tags:
 *                        type: array
 *                        items:
 *                          type: string
 *                      image_url:
 *                        type: string
 *                      status:
 *                        type: string
 *                      approved_by:
 *                        type: string
 *                      approved_at:
 *                        type: string
 *                      score:
 *                        type: number
 *                        description: Cosine similarity score between user preferences and event tags
 *      500:
 *        description: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Get current user
    // const supabase = await createClient();
    // const {
    //   data: { user },
    // } = await supabase.auth.getUser();
    //
    // if (!user) {
    //   return NextResponse.json(
    //     { error: "Unauthorized" },
    //     { status: 401 }
    //   );
    // }
    //
    // TODO: Fetch user profile with interest tags
    // const { data: userProfile } = await supabase
    //   .from("users")
    //   .select("interest_tags")
    //   .eq("id", user.id)
    //   .single();

    // Fetch events from existing events API
    const eventsRes = await fetch(`${request.nextUrl.origin}/api/events`, {
      cache: "no-store",
    });
    if (!eventsRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      );
    }
    const eventsData = await eventsRes.json();
    const events = Array.isArray(eventsData) ? eventsData : eventsData.events || [];

    // TODO: Use real user context and tags from Supabase auth/profile
    // TODO: When events come from DB, ensure tags align with CATEGORY_ORDER in Flask
    // TODO: Apply filters before scoring:
    // - Filter by user's interest_tags
    // - Exclude already saved events
    // - Order by relevance (tag matches, date proximity, etc.)
    // - Limit to top N recommendations (e.g., 10)

    // Score events via Flask (cosine similarity)
    const scoreRes = await fetch(`${FLASK_BASE_URL}/similarity/events-score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_tags: SAMPLE_USER_TAGS,
        events: events.map((evt: any) => ({ id: evt.id, tags: evt.tags || [] })),
      }),
    });

    if (!scoreRes.ok) {
      return NextResponse.json(
        { error: "Failed to score events" },
        { status: 500 }
      );
    }

    const scoreData = await scoreRes.json();
    const scoreMap: Record<string, number> = {};
    for (const ev of scoreData.events || []) {
      scoreMap[ev.id] = ev.score;
    }

    const recommendations = events
      .map((evt: any) => ({ ...evt, score: scoreMap[evt.id] }))
      .sort((a: any, b: any) => (b.score ?? -1) - (a.score ?? -1));

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}

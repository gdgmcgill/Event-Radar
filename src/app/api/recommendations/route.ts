/**
 * POST /api/recommendations
 * Get personalized event recommendations for the current user
 * Calls the Two-Tower Recommendation Service
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Recommendation service URL (configurable via environment variable)
const RECOMMENDATION_API_URL =
  process.env.RECOMMENDATION_API_URL || "http://localhost:8000";

interface UserPayload {
  major: string;
  year_of_study: string;
  clubs_or_interests: string[];
  attended_events?: string[];
}

interface RecommendRequest {
  user: UserPayload;
  top_k?: number;
  exclude_event_ids?: string[];
}

interface RecommendationItem {
  event_id: string;
  score: number;
  title: string;
  description: string;
  tags: string[];
  hosting_club: string | null;
  category: string | null;
}

interface RecommendResponse {
  recommendations: RecommendationItem[];
  total_events: number;
}

/**
 * @swagger
 * /api/recommendations:
 *   get:
 *    summary: Get personalized event recommendations
 *    description: Returns events scored using Two-Tower neural network recommendation system
 *    tags:
 *      - Recommendations
 *    parameters:
 *      - name: top_k
 *        in: query
 *        description: Number of recommendations to return
 *        schema:
 *          type: integer
 *          default: 10
 *    responses:
 *      200:
 *        description: Recommendations fetched successfully
 *      401:
 *        description: Unauthorized
 *      500:
 *        description: Internal server error
 *   post:
 *    summary: Get recommendations with custom user payload
 *    description: Returns recommendations using provided user profile data
 *    tags:
 *      - Recommendations
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              user:
 *                type: object
 *                properties:
 *                  major:
 *                    type: string
 *                  year_of_study:
 *                    type: string
 *                  clubs_or_interests:
 *                    type: array
 *                    items:
 *                      type: string
 *              top_k:
 *                type: integer
 *              exclude_event_ids:
 *                type: array
 *                items:
 *                  type: string
 *    responses:
 *      200:
 *        description: Recommendations fetched successfully
 *      400:
 *        description: Missing user payload
 *      500:
 *        description: Internal server error
 */

/**
 * POST handler - Get recommendations with user payload
 */
export async function POST(request: NextRequest) {
  try {
    const body: RecommendRequest = await request.json();

    // Validate request
    if (!body.user) {
      return NextResponse.json(
        { error: "Missing user payload" },
        { status: 400 }
      );
    }

    // Call the recommendation service
    const response = await fetch(`${RECOMMENDATION_API_URL}/recommend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Recommendation service error:", errorText);
      return NextResponse.json(
        { error: "Recommendation service error", detail: errorText },
        { status: response.status }
      );
    }

    const data: RecommendResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}

/**
 * GET handler - Get recommendations for the authenticated user
 * Automatically fetches user profile and interaction data from Supabase
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user profile with interest tags
    interface UserProfileRow {
      interest_tags: string[];
      full_name: string | null;
    }
    const { data: profileData } = await supabase
      .from("users")
      .select("interest_tags, full_name")
      .eq("id", user.id)
      .single();

    const userProfile = profileData as UserProfileRow | null;

    // Fetch user's saved events to exclude
    interface SavedEventRow {
      event_id: string;
    }
    const { data: savedData } = await supabase
      .from("saved_events")
      .select("event_id")
      .eq("user_id", user.id);

    const savedEvents = (savedData || []) as unknown as SavedEventRow[];
    const excludeEventIds = savedEvents.map((se) => se.event_id);

    // Fetch high-intent interactions to use as "attended_events" for the model
    // High-intent = save, click, calendar_add (indicates strong interest)
    interface InteractionRow {
      event_id: string;
    }
    const { data: highIntentData } = await supabase
      .from("user_interactions")
      .select("event_id")
      .eq("user_id", user.id)
      .in("interaction_type", ["save", "click", "calendar_add"])
      .order("created_at", { ascending: false })
      .limit(50);

    const highIntentInteractions = (highIntentData || []) as unknown as InteractionRow[];

    // Get unique event IDs from high-intent interactions
    const attendedEventIds = [...new Set(highIntentInteractions.map((i) => i.event_id))];

    // Fetch user's engagement summary for additional personalization
    interface EngagementRow {
      favorite_tags: { tag: string; count: number }[];
      favorite_clubs: { club_id: string; count: number }[];
    }
    const { data: engagementData } = await supabase
      .from("user_engagement_summary")
      .select("favorite_tags, favorite_clubs")
      .eq("user_id", user.id)
      .maybeSingle();

    const engagementSummary = engagementData as EngagementRow | null;

    // Combine interest tags from profile and favorite tags from engagement
    const interestTags = userProfile?.interest_tags || [];
    const favoriteTags = engagementSummary?.favorite_tags || [];

    // Extract tag names from favorite_tags and combine with profile interests
    const engagedTags = Array.isArray(favoriteTags)
      ? favoriteTags.map((t) => t.tag)
      : [];

    // Merge and deduplicate interests
    const combinedInterests = [...new Set([...interestTags, ...engagedTags])];

    // Build user payload from profile and interaction data
    const userPayload: UserPayload = {
      major: "General Studies", // Default if not in profile
      year_of_study: "Student",
      clubs_or_interests: combinedInterests,
      attended_events: attendedEventIds,
    };

    // Get top_k from query params
    const searchParams = request.nextUrl.searchParams;
    const topK = parseInt(searchParams.get("top_k") || "10", 10);

    // Call the recommendation service
    const response = await fetch(`${RECOMMENDATION_API_URL}/recommend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user: userPayload,
        top_k: topK,
        exclude_event_ids: excludeEventIds,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Recommendation service error:", errorText);

      // Fallback: return empty recommendations if service is unavailable
      return NextResponse.json({
        recommendations: [],
        total_events: 0,
        fallback: true,
      });
    }

    const data: RecommendResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}

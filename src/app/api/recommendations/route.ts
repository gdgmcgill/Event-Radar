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
 * Automatically fetches user profile from Supabase
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
    const { data: userProfile } = await supabase
      .from("users")
      .select("interest_tags, full_name")
      .eq("id", user.id)
      .single();

    // Fetch user's saved events to exclude
    const { data: savedEvents } = await supabase
      .from("saved_events")
      .select("event_id")
      .eq("user_id", user.id);

    const excludeEventIds = savedEvents?.map((se) => se.event_id) || [];

    // Build user payload from profile
    const userPayload: UserPayload = {
      major: "General Studies", // Default if not in profile
      year_of_study: "Student",
      clubs_or_interests: userProfile?.interest_tags || [],
      attended_events: [],
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

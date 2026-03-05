/**
 * POST /api/recommendations
 * Get personalized event recommendations for the current user
 * Calls the Two-Tower Recommendation Service
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rerankWithMMR, type RecommendationItem as DiversityRecommendationItem } from "@/lib/diversity";

// Recommendation service URL (configurable via environment variable)
const RECOMMENDATION_API_URL =
  process.env.RECOMMENDATION_API_URL || "http://localhost:8000";

interface UserPayload {
  major: string;
  year_of_study: string;
  clubs_or_interests: string[];
  attended_events?: string[];
}

interface FeedbackItem {
  event_id: string;
  feedback_type: "positive" | "negative";
  tags: string[];
}

interface RecommendRequest {
  user: UserPayload;
  top_k?: number;
  exclude_event_ids?: string[];
  feedback?: FeedbackItem[];
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

interface RecommendationItemWithExplanation extends RecommendationItem {
  explanation?: string;
}

interface RecommendResponse {
  recommendations: RecommendationItem[];
  total_events: number;
}

function formatTagLabel(tag: string): string {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

function generateExplanation(
  rec: RecommendationItem,
  userInterests: string[],
  positiveFeedbackTags: Set<string>,
  source: "personalized" | "popular_fallback"
): string {
  if (source === "popular_fallback") {
    return "Trending on campus this week";
  }

  // Check overlap between event tags and user's explicit interest tags
  const interestOverlap = rec.tags.filter((t) =>
    userInterests.some((ui) => ui.toLowerCase() === t.toLowerCase())
  );
  if (interestOverlap.length > 0) {
    const labels = interestOverlap.slice(0, 2).map(formatTagLabel);
    return `Because you're interested in ${labels.join(" and ")}`;
  }

  // Check overlap with tags from positively-rated or saved events
  const feedbackOverlap = rec.tags.filter((t) => positiveFeedbackTags.has(t.toLowerCase()));
  if (feedbackOverlap.length > 0) {
    const labels = feedbackOverlap.slice(0, 2).map(formatTagLabel);
    return `Similar to events you've liked in ${labels.join(" and ")}`;
  }

  // High-score fallback
  if (rec.score >= 0.8) {
    return "Highly recommended based on your profile";
  }

  return "Recommended for you";
}

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

    // Forward the full body (including optional feedback) to the AI service
    let response: Response;
    try {
      response = await fetch(`${RECOMMENDATION_API_URL}/recommend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (fetchError) {
      console.warn("Recommendation service unreachable:", fetchError);
      return NextResponse.json(
        { error: "Recommendation service unavailable", fallback: true },
        { status: 503 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Recommendation service error:", errorText);
      return NextResponse.json(
        { error: "Recommendation service error", detail: errorText },
        { status: response.status }
      );
    }

    const data: RecommendResponse = await response.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
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
    const { data: userProfileData } = await supabase
      .from("users")
      .select("interest_tags, full_name")
      .eq("id", user.id)
      .single();

    type UserProfileRow = { interest_tags: string[] | null; full_name: string | null };
    const userProfile = userProfileData as UserProfileRow | null;

    // Fetch saved events and explicit feedback in parallel
    const [savedEventsResult, rawFeedbackResult] = await Promise.all([
      supabase
        .from("saved_events")
        .select("event_id")
        .eq("user_id", user.id),
      supabase
        .from("recommendation_explicit_feedback")
        .select("event_id, feedback_type")
        .eq("user_id", user.id),
    ]);

    const savedList = (savedEventsResult.data ?? []) as { event_id: string }[];
    const excludeEventIds = savedList.map((se) => se.event_id);

    const feedbackRows = (rawFeedbackResult.data ?? []) as {
      event_id: string;
      feedback_type: string;
    }[];

    // Collect all event IDs that need tag lookups (saved + explicitly rated)
    const allSignalEventIds = [
      ...excludeEventIds,
      ...feedbackRows.map((r) => r.event_id),
    ];
    const uniqueSignalIds = [...new Set(allSignalEventIds)];

    let feedbackPayload: FeedbackItem[] = [];
    if (uniqueSignalIds.length > 0) {
      const { data: signalEvents } = await supabase
        .from("events")
        .select("id, tags")
        .in("id", uniqueSignalIds);

      type SignalEvent = { id: string; tags: string[] | null };
      const signalList = (signalEvents ?? []) as SignalEvent[];
      const tagsById: Record<string, string[]> = {};
      for (const ev of signalList) {
        tagsById[ev.id] = ev.tags ?? [];
      }

      // Explicit thumbs feedback (strongest signal)
      const explicitFeedback = feedbackRows
        .filter((r) => r.feedback_type === "positive" || r.feedback_type === "negative")
        .map((r) => ({
          event_id: r.event_id,
          feedback_type: r.feedback_type as "positive" | "negative",
          tags: tagsById[r.event_id] ?? [],
        }));

      // Saved events as implicit positive signals (user chose to save them)
      const explicitIds = new Set(feedbackRows.map((r) => r.event_id));
      const implicitPositive = excludeEventIds
        .filter((id) => !explicitIds.has(id))
        .map((id) => ({
          event_id: id,
          feedback_type: "positive" as const,
          tags: tagsById[id] ?? [],
        }));

      feedbackPayload = [...explicitFeedback, ...implicitPositive];
    }

    // Build user payload from profile
    const userPayload: UserPayload = {
      major: "General Studies", // Default if not in profile
      year_of_study: "Student",
      clubs_or_interests: userProfile?.interest_tags ?? [],
      attended_events: [], // Could fetch from attendance history
    };

    // Get top_k from query params
    const searchParams = request.nextUrl.searchParams;
    const topK = parseInt(searchParams.get("top_k") || "10", 10);

    // Call the recommendation service, including feedback for vector adjustment
    let response: Response;
    try {
      response = await fetch(`${RECOMMENDATION_API_URL}/recommend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user: userPayload,
          top_k: topK,
          exclude_event_ids: excludeEventIds,
          feedback: feedbackPayload.length > 0 ? feedbackPayload : undefined,
        }),
      });
    } catch (fetchError) {
      console.warn("Recommendation service unreachable, returning fallback:", fetchError);
      return NextResponse.json({
        recommendations: [],
        total_events: 0,
        source: "popular_fallback",
        fallback: true,
      }, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Recommendation service error:", errorText);

      // Fallback: return empty recommendations if service is unavailable
      return NextResponse.json({
        recommendations: [],
        total_events: 0,
        source: "popular_fallback",
        fallback: true,
      }, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    const data: RecommendResponse = await response.json();

    // Apply MMR diversity re-ranking
    const diversityParam = searchParams.get("diversity");
    const diversityLambda = diversityParam ? parseFloat(diversityParam) : 0.7;
    const lambda = Math.max(0, Math.min(1, isNaN(diversityLambda) ? 0.7 : diversityLambda));

    const { items: diversifiedRecs, metadata: diversityMetadata } = rerankWithMMR(
      data.recommendations as unknown as DiversityRecommendationItem[],
      lambda
    );

    // Determine source: if no personal signals exist, this is a popular fallback
    const hasPersonalSignals =
      feedbackPayload.length > 0 ||
      (userProfile?.interest_tags ?? []).length > 0;
    const source: "personalized" | "popular_fallback" = hasPersonalSignals
      ? "personalized"
      : "popular_fallback";

    // Build set of tags the user has shown positive affinity toward
    const positiveFeedbackTags = new Set<string>();
    for (const fb of feedbackPayload) {
      if (fb.feedback_type === "positive") {
        for (const tag of fb.tags) {
          positiveFeedbackTags.add(tag.toLowerCase());
        }
      }
    }

    const userInterests = userProfile?.interest_tags ?? [];
    const recommendationsWithExplanations: RecommendationItemWithExplanation[] =
      diversifiedRecs.map((rec) => ({
        ...rec,
        explanation: generateExplanation(rec as unknown as RecommendationItem, userInterests, positiveFeedbackTags, source),
      }));

    return NextResponse.json(
      {
        ...data,
        source,
        recommendations: recommendationsWithExplanations,
        diversity_metadata: diversityMetadata,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}

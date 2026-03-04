/**
 * POST /api/recommendations/feedback
 * - Thumbs: body { event_id, feedback: "positive" | "negative" } → upsert recommendation_explicit_feedback (one per user/event)
 * - Analytics: body { event_id, recommendation_rank, action, session_id? } → insert recommendation_feedback
 *
 * GET /api/recommendations/feedback?event_ids=id1,id2
 * - Returns { feedback: { [eventId]: "positive" | "negative" } } for the authenticated user.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import type { RecommendationFeedbackAction } from "@/types";
import type { Database } from "@/lib/supabase/types";

type RecommendationFeedbackInsert =
  Database["public"]["Tables"]["recommendation_feedback"]["Insert"];

const VALID_ACTIONS: RecommendationFeedbackAction[] = [
  "impression",
  "click",
  "save",
  "dismiss",
];

const VALID_THUMBS = ["positive", "negative"] as const;
type ThumbsFeedback = (typeof VALID_THUMBS)[number];

interface ThumbsBody {
  event_id: string;
  feedback: ThumbsFeedback;
  user_id?: string;
}

interface AnalyticsBody {
  user_id?: string;
  event_id: string;
  recommendation_rank: number;
  action: RecommendationFeedbackAction;
  session_id?: string;
}

/** GET: fetch current user's thumbs feedback for given event_ids */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eventIds = request.nextUrl.searchParams.get("event_ids")?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];
    if (eventIds.length === 0) {
      return NextResponse.json({ feedback: {} });
    }

    const { data: rawRows } = await supabase
      .from("recommendation_explicit_feedback")
      .select("event_id, feedback_type")
      .eq("user_id", user.id)
      .in("event_id", eventIds);

    const list = (rawRows ?? []) as { event_id: string; feedback_type: string }[];
    const feedback: Record<string, ThumbsFeedback> = {};
    for (const row of list) {
      if (VALID_THUMBS.includes(row.feedback_type as ThumbsFeedback)) {
        feedback[row.event_id] = row.feedback_type as ThumbsFeedback;
      }
    }

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("Recommendation feedback GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}

/** POST: thumbs (event_id + feedback) or analytics (event_id + recommendation_rank + action) */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const body = (await request.json()) as ThumbsBody | AnalyticsBody;

    // --- Thumbs up/down: event_id + feedback (positive | negative) ---
    if ("feedback" in body && typeof body.feedback === "string") {
      const feedback = body.feedback as string;
      if (!VALID_THUMBS.includes(feedback as ThumbsFeedback)) {
        return NextResponse.json(
          { error: "Invalid feedback. Must be 'positive' or 'negative'" },
          { status: 400 }
        );
      }
      const event_id = body.event_id;
      if (!event_id) {
        return NextResponse.json(
          { error: "Missing event_id" },
          { status: 400 }
        );
      }
      const userId = authUser?.id ?? (body as ThumbsBody).user_id;
      if (!userId) {
        return NextResponse.json(
          { error: "Unauthorized. Must be logged in to submit feedback." },
          { status: 401 }
        );
      }

      const { error: upsertError } = await supabase
        .from("recommendation_explicit_feedback")
        .upsert(
          {
            user_id: userId,
            event_id,
            feedback_type: feedback,
          },
          { onConflict: "user_id,event_id" }
        );

      if (upsertError) {
        console.error("Recommendation explicit feedback upsert error:", upsertError);
        return NextResponse.json(
          { error: "Failed to store feedback", detail: upsertError.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, feedback });
    }

    // --- Analytics: impression, click, save, dismiss ---
    const { event_id, recommendation_rank, action, session_id } = body as AnalyticsBody;

    if (!event_id || recommendation_rank == null || !action) {
      return NextResponse.json(
        { error: "Missing required fields: event_id, recommendation_rank, action" },
        { status: 400 }
      );
    }

    if (!VALID_ACTIONS.includes(action as RecommendationFeedbackAction)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    if (recommendation_rank < 1) {
      return NextResponse.json(
        { error: "recommendation_rank must be >= 1" },
        { status: 400 }
      );
    }

    const userId = authUser?.id ?? (body as AnalyticsBody).user_id;
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized. Must be logged in to submit feedback." },
        { status: 401 }
      );
    }

    const row: RecommendationFeedbackInsert = {
      user_id: userId,
      event_id,
      recommendation_rank,
      action: action as string,
      session_id: session_id ?? null,
    };

    const { error } = await supabase
      .from("recommendation_feedback")
      .insert(row as any);

    if (error) {
      console.error("Recommendation feedback insert error:", error);
      return NextResponse.json(
        { error: "Failed to store feedback", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Recommendation feedback error:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}

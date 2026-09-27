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
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { parseBody, parseQuery } from "@/server/body";
import {
  FeedbackEventIdsQuery,
  RecommendationFeedbackBody,
  THUMBS_FEEDBACK,
  type ThumbsFeedback,
} from "@/contracts/recommendations";
import type { NextRequest } from "next/server";

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

    const query = parseQuery(request.nextUrl.searchParams, FeedbackEventIdsQuery);
    if (!query.ok) return query.response;
    const eventIds = query.data.event_ids;
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
      if (THUMBS_FEEDBACK.includes(row.feedback_type as ThumbsFeedback)) {
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
    const ctx = await createRequestContext();

    // Keeps this arm's own anonymous bytes (DEC-34). Every row below is
    // written with the authenticated caller's id only: the contract declares
    // no user id, so a body naming one is parsed without it (DI-44).
    if (!ctx.user) {
      return NextResponse.json(
        { error: "Unauthorized. Must be logged in to submit feedback." },
        { status: 401 }
      );
    }

    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const authUser = active.user;
    const supabase = ctx.supabase;

    // Thumbs (a string `feedback`) or analytics, branched as before; each
    // shape carries today's 400s in today's order. A body that is not a JSON
    // object answers 400 instead of 500 (F-094).
    const parsed = await parseBody(request, RecommendationFeedbackBody);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // --- Thumbs up/down: event_id + feedback (positive | negative) ---
    if (body.kind === "thumbs") {
      const { feedback, event_id } = body;

      const { error: upsertError } = await supabase
        .from("recommendation_explicit_feedback")
        .upsert(
          {
            user_id: authUser.id,
            event_id,
            feedback_type: feedback,
          },
          { onConflict: "user_id,event_id" }
        );

      if (upsertError) {
        console.error("Recommendation explicit feedback upsert error:", upsertError);
        return NextResponse.json(
          { error: "Failed to store feedback" },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, feedback });
    }

    // --- Analytics: impression, click, save, dismiss ---
    const { event_id, recommendation_rank, action, session_id } = body;

    const row = {
      user_id: authUser.id,
      event_id,
      recommendation_rank,
      action: action as string,
      session_id: session_id ?? null,
      experiment_variant_id: body.experiment_variant_id ?? null,
    };

    const { error } = await supabase
      .from("recommendation_feedback")
      .insert(row as any);

    if (error) {
      console.error("Recommendation feedback insert error:", error);
      return NextResponse.json(
        { error: "Failed to store feedback" },
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

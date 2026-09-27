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
import { withRoute } from "@/server/route";
import { getElevatedClient } from "@/server/db/elevated";
import { log } from "@/server/log";

/** GET: fetch current user's thumbs feedback for given event_ids */
export const GET = withRoute({ cache: "private", action: "fetch feedback" }, async (request: NextRequest) => {
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

    const { data: rawRows, error: feedbackError } = await supabase
      .from("recommendation_explicit_feedback")
      .select("event_id, feedback_type")
      .eq("user_id", user.id)
      .in("event_id", eventIds);

    if (feedbackError) throw feedbackError;

    const list = (rawRows ?? []) as { event_id: string; feedback_type: string }[];
    const feedback: Record<string, ThumbsFeedback> = {};
    for (const row of list) {
      if (THUMBS_FEEDBACK.includes(row.feedback_type as ThumbsFeedback)) {
        feedback[row.event_id] = row.feedback_type as ThumbsFeedback;
      }
    }

    return NextResponse.json({ feedback });
  } catch (error) {
    log.error("Recommendation feedback GET error", { error });
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
});

/** POST: thumbs (event_id + feedback) or analytics (event_id + recommendation_rank + action) */
export const POST = withRoute({ cache: "private", action: "submit feedback" }, async (request: NextRequest) => {
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
        log.error("Recommendation explicit feedback upsert error", { error: upsertError });
        return NextResponse.json(
          { error: "Failed to store feedback" },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, feedback });
    }

    // --- Analytics: impression, click, save, dismiss ---
    const { event_id, recommendation_rank, action, session_id } = body;

    // M0 WR-07: resolve attribution from server-owned assignments only.
    // Feedback never creates an assignment. The same deterministic experiment
    // selection is used by GET /recommendations. Ended experiments get no credit.
    // INSERT is service-only so direct Data API requests cannot forge attribution.
    const elevated = getElevatedClient();
    const { data: experiments, error: experimentsError } = await elevated
      .from("experiments")
      .select("id")
      .eq("status", "running")
      .order("id", { ascending: true })
      .limit(1);
    if (experimentsError) throw experimentsError;

    let experimentVariantId: string | null = null;
    if (experiments?.[0]) {
      const { data: assignment, error: assignmentError } = await elevated
        .from("experiment_assignments")
        .select("variant_id")
        .eq("experiment_id", experiments[0].id)
        .eq("user_id", authUser.id)
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      experimentVariantId = assignment?.variant_id ?? null;
    }

    const row = {
      user_id: authUser.id,
      event_id,
      recommendation_rank,
      action: action as string,
      session_id: session_id ?? null,
      experiment_variant_id: experimentVariantId,
    };

    const { error } = await elevated
      .from("recommendation_feedback")
      .insert(row as any);

    if (error) {
      log.error("Recommendation feedback insert error", { error });
      return NextResponse.json(
        { error: "Failed to store feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error("Recommendation feedback error", { error });
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
});

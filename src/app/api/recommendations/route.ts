/**
 * GET /api/recommendations
 * Personalized event recommendations using precomputed Postgres scores.
 *
 * - Authenticated users: query user_event_scores, apply session boost + MMR
 * - Anonymous users: return popularity-ordered events
 * - Fallback: if no precomputed scores, return popularity-ordered events
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  rerankWithMMR,
  type RecommendationItem as DiversityRecommendationItem,
} from "@/lib/diversity";
import { pickVariant } from "@/lib/experiments";
import {
  expandTagsWithHierarchy,
  computeSessionBoost,
  generateExplanation,
  type ScoreBreakdown,
} from "@/lib/recommendations";

/**
 * GET handler - recommendations for the current user (or anonymous fallback)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const topK = parseInt(searchParams.get("top_k") || "10", 10);

    // --- 1. Authenticate user (anonymous is OK) ---
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Anonymous users get popularity fallback
    if (!user) {
      const { data: popularEvents } = await supabase
        .from("events")
        .select("*, clubs(*)")
        .eq("status", "approved")
        .order("event_date", { ascending: true })
        .limit(topK);

      const recommendations = (popularEvents ?? []).map((event) => ({
        event_id: event.id,
        score: 0,
        explanation: "Trending on campus",
        breakdown: { tag: 0, interaction: 0, popularity: 1, recency: 0, social: 0 },
        event,
      }));

      return NextResponse.json(
        {
          recommendations,
          source: "anonymous" as const,
          total_events: recommendations.length,
        },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    // --- 2. Fetch user profile (interest_tags + inferred_tags) ---
    const { data: userProfileData } = await supabase
      .from("users")
      .select("interest_tags, inferred_tags, full_name")
      .eq("id", user.id)
      .single();

    type UserProfileRow = {
      interest_tags: string[] | null;
      inferred_tags: string[] | null;
      full_name: string | null;
    };
    const userProfile = userProfileData as UserProfileRow | null;
    const allUserTags = [
      ...(userProfile?.interest_tags ?? []),
      ...(userProfile?.inferred_tags ?? []),
    ];
    const expandedTags = expandTagsWithHierarchy(allUserTags);

    // --- 3. Query user_event_scores for precomputed scores ---
    const { data: scoreRows } = await (supabase
      .from("user_event_scores" as any)
      .select("event_id, score, breakdown, events(*, clubs(*))")
      .eq("user_id", user.id)
      .order("score", { ascending: false })
      .limit(topK * 3) as any);

    type ScoreRow = {
      event_id: string;
      score: number;
      breakdown: ScoreBreakdown;
      events: Record<string, unknown>;
    };
    const typedScoreRows = (scoreRows ?? []) as ScoreRow[];

    // Filter to only approved events
    const approvedScoreRows = typedScoreRows.filter(
      (r) => r.events && (r.events as any).status === "approved"
    );

    // --- 4. Fall back to popularity if no scores ---
    const hasScores = approvedScoreRows.length > 0;
    let source: "personalized" | "popular_fallback" | "anonymous";

    if (!hasScores) {
      source = "popular_fallback";
      const { data: popularEvents } = await supabase
        .from("events")
        .select("*, clubs(*)")
        .eq("status", "approved")
        .order("event_date", { ascending: true })
        .limit(topK);

      const recommendations = (popularEvents ?? []).map((event) => ({
        event_id: event.id,
        score: 0,
        explanation: "Trending on campus",
        breakdown: { tag: 0, interaction: 0, popularity: 1, recency: 0, social: 0 },
        event,
      }));

      return NextResponse.json(
        {
          recommendations,
          source,
          total_events: recommendations.length,
        },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    source = "personalized";

    // --- 5. Apply session boost from recent interactions (last 2 hours) ---
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: recentInteractions } = await supabase
      .from("user_interactions")
      .select("event_id, events(tags)")
      .eq("user_id", user.id)
      .gte("created_at", twoHoursAgo)
      .order("created_at", { ascending: false })
      .limit(10);

    // Collect tags from recent interactions
    const sessionTags: string[] = [];
    for (const interaction of recentInteractions ?? []) {
      const event = (interaction as any).events;
      if (event && Array.isArray(event.tags)) {
        sessionTags.push(...event.tags);
      }
    }

    // Build scored items with session boost applied
    const scoredItems = approvedScoreRows.map((row) => {
      const event = row.events as any;
      const eventTags: string[] = event.tags ?? [];
      const boost = computeSessionBoost(sessionTags, eventTags);
      const boostedScore = Math.min(row.score + boost, 1.0);

      return {
        event_id: row.event_id,
        score: boostedScore,
        tags: eventTags,
        title: event.title ?? "",
        description: event.description ?? "",
        hosting_club: event.clubs?.name ?? null,
        category: eventTags[0] ?? null,
        breakdown: row.breakdown,
        event,
      };
    });

    // --- 6. A/B experiment framework (preserved) ---
    let experimentVariantId: string | null = null;
    let experimentLambda: number | null = null;

    const { data: activeExperiments } = await supabase
      .from("experiments")
      .select("id, name, status")
      .eq("status", "running");

    if (activeExperiments && activeExperiments.length > 0) {
      const experiment = activeExperiments[0] as { id: string; name: string };

      const { data: variantRows } = await supabase
        .from("experiment_variants")
        .select("*")
        .eq("experiment_id", experiment.id);

      type VRow = {
        id: string;
        experiment_id: string;
        name: string;
        config: Record<string, unknown>;
        weight: number;
      };
      const variants = (variantRows ?? []) as VRow[];

      if (variants.length >= 2) {
        const { data: existingAssignment } = await supabase
          .from("experiment_assignments")
          .select("variant_id")
          .eq("experiment_id", experiment.id)
          .eq("user_id", user.id)
          .single();

        let assignedVariant: VRow;
        if (existingAssignment) {
          assignedVariant =
            variants.find((v) => v.id === existingAssignment.variant_id) ??
            variants[0];
        } else {
          assignedVariant = pickVariant(
            user.id,
            experiment.id,
            variants
          ) as VRow;
          await supabase.from("experiment_assignments").insert({
            experiment_id: experiment.id,
            variant_id: assignedVariant.id,
            user_id: user.id,
          });
        }

        experimentVariantId = assignedVariant.id;
        if (typeof assignedVariant.config?.lambda === "number") {
          experimentLambda = assignedVariant.config.lambda as number;
        }
      }
    }

    // --- 6b. MMR diversity re-ranking ---
    const diversityParam = searchParams.get("diversity");
    const baseLambda = diversityParam ? parseFloat(diversityParam) : 0.7;
    const lambda =
      experimentLambda ??
      (isNaN(baseLambda) ? 0.7 : Math.max(0, Math.min(1, baseLambda)));

    const mmrInput: DiversityRecommendationItem[] = scoredItems.map((item) => ({
      event_id: item.event_id,
      score: item.score,
      tags: item.tags,
      title: item.title,
      description: item.description,
      hosting_club: item.hosting_club,
      category: item.category,
    }));

    const { items: diversifiedRecs, metadata: diversityMetadata } =
      rerankWithMMR(mmrInput, lambda);

    // Build a lookup for breakdown and event data by event_id
    const itemLookup = new Map(
      scoredItems.map((item) => [item.event_id, item])
    );

    // --- 7. Generate explanations from breakdown ---
    const expandedTagStrings = expandedTags.map((t) => t.tag);

    const recommendations = diversifiedRecs.slice(0, topK).map((rec) => {
      const original = itemLookup.get(rec.event_id)!;
      const breakdown: ScoreBreakdown = original.breakdown ?? {
        tag: 0,
        interaction: 0,
        popularity: 0,
        recency: 0,
        social: 0,
      };

      // Find matching tags between user's expanded tags and event tags
      const matchingTags = rec.tags.filter((t) =>
        expandedTagStrings.some(
          (ut) => ut.toLowerCase() === t.toLowerCase()
        )
      );

      const explanation = generateExplanation(breakdown, matchingTags);

      return {
        event_id: rec.event_id,
        score: rec.score,
        explanation,
        breakdown,
        event: original.event,
      };
    });

    // --- 8. Return response ---
    return NextResponse.json(
      {
        recommendations,
        source,
        diversity_metadata: {
          avg_pairwise_distance: diversityMetadata.avg_pairwise_distance,
          lambda: diversityMetadata.lambda,
        },
        experiment_variant_id: experimentVariantId,
        total_events: recommendations.length,
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

/**
 * POST /api/admin/calculate-popularity
 * Recalculate popularity scores for all events
 *
 * Admin only. Both verbs decide admin through the request context
 * (requireActiveUser, then requireRole), and the recompute runs on the
 * elevated door. The former machine-key gate admitted every caller when its
 * environment variable was unset (F-001, FO-01, fixed in 05-14).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { readQuery } from "@/server/body";
import { CalculatePopularityQuery } from "@/contracts/admin";
import { getElevatedClient } from "@/server/db/elevated";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

/**
 * @swagger
 * /api/admin/calculate-popularity:
 *   post:
 *     summary: Recalculate all event popularity scores
 *     description: Admin endpoint to recalculate popularity and trending scores for all events
 *     tags:
 *       - Admin
 *     parameters:
 *       - name: event_id
 *         in: query
 *         description: Optional specific event ID to recalculate
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Popularity scores recalculated successfully
 *       401:
 *         description: Unauthorized - not signed in
 *       403:
 *         description: Forbidden - not an admin, or the account is suspended
 *       500:
 *         description: Internal server error
 */
export const POST = withRoute({ cache: "private", action: "calculate popularity" }, async (request: NextRequest) => {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;

  try {
    const { event_id: specificEventId } = readQuery(
      request.nextUrl.searchParams,
      CalculatePopularityQuery
    );

    // The recompute writes event_popularity_scores, which are service-role
    // only by design (F-010). REGISTRY.md row: popularity recompute.
    const supabase = getElevatedClient();

    let eventIds: string[] = [];
    let results = {
      total: 0,
      success: 0,
      failed: 0,
      errors: [] as { event_id: string; error: string }[],
    };

    if (specificEventId) {
      // Recalculate for a specific event
      eventIds = [specificEventId];
    } else {
      // Get all approved events
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id")
        .eq("status", "approved");

      if (eventsError) {
        log.error("Error fetching events", { error: eventsError });
        return NextResponse.json(
          { error: "Failed to fetch events" },
          { status: 500 }
        );
      }

      eventIds = (events || []).map((e: { id: string }) => e.id);
    }

    results.total = eventIds.length;

    // Process events in batches to avoid overloading the database
    const BATCH_SIZE = 10;
    for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
      const batch = eventIds.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (eventId) => {
          try {
            // Call the database function to update popularity
            const { error: rpcError } = await supabase.rpc(
              "update_event_popularity",
              { p_event_id: eventId }
            );

            if (rpcError) {
              log.error("Error updating event popularity", { eventId, error: rpcError });
              results.failed++;
              results.errors.push({
                event_id: eventId,
                error: "Failed to update popularity",
              });
            } else {
              results.success++;
            }
          } catch (err) {
            log.error("Unexpected error updating event popularity", { eventId, error: err });
            results.failed++;
            results.errors.push({
              event_id: eventId,
              error: "Failed to update popularity",
            });
          }
        })
      );
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.total} events`,
      results: {
        total: results.total,
        success: results.success,
        failed: results.failed,
        ...(results.errors.length > 0 && { errors: results.errors }),
      },
      calculated_at: new Date().toISOString(),
    });
  } catch (error) {
    log.error("Unexpected error calculating popularity", { error: error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});

/**
 * GET /api/admin/calculate-popularity
 * Get statistics about popularity score calculations
 */
export const GET = withRoute({ cache: "private", action: "fetch statistics" }, async (_request: NextRequest) => {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;

  try {
    // Same door as POST: the scores table is service-role only (F-010).
    const supabase = getElevatedClient();

    // Get statistics about popularity scores
    interface PopularityStats {
      last_calculated_at: string;
      popularity_score: number;
      trending_score: number;
    }

    const { data: statsData, error: statsError } = await supabase
      .from("event_popularity_scores")
      .select("last_calculated_at, popularity_score, trending_score");

    if (statsError) {
      log.error("Error fetching stats", { error: statsError });
      return NextResponse.json(
        { error: "Failed to fetch statistics" },
        { status: 500 }
      );
    }

    const stats = (statsData || []) as PopularityStats[];

    // Get total events count
    const { count: totalEvents } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved");

    // Calculate statistics
    const eventsWithScores = stats.length;
    const oldestCalculation = stats.length > 0
      ? stats.reduce((oldest, current) =>
          new Date(current.last_calculated_at) < new Date(oldest.last_calculated_at)
            ? current
            : oldest
        ).last_calculated_at
      : null;

    const avgPopularity = stats.length > 0
      ? stats.reduce((sum, s) => sum + s.popularity_score, 0) / stats.length
      : 0;

    const avgTrending = stats.length > 0
      ? stats.reduce((sum, s) => sum + s.trending_score, 0) / stats.length
      : 0;

    return NextResponse.json({
      total_events: totalEvents || 0,
      events_with_scores: eventsWithScores,
      events_without_scores: (totalEvents || 0) - eventsWithScores,
      oldest_calculation: oldestCalculation,
      average_popularity_score: Math.round(avgPopularity * 100) / 100,
      average_trending_score: Math.round(avgTrending * 100) / 100,
    });
  } catch (error) {
    log.error("Unexpected error fetching statistics", { error: error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});

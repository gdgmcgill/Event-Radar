/**
 * POST /api/admin/calculate-popularity
 * Recalculate popularity scores for all events
 *
 * This endpoint should be called periodically (e.g., via cron job)
 * to keep popularity scores up to date.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Create admin client with service role key
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

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
 *         description: Unauthorized - requires API key
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    // Simple API key authentication for admin endpoints
    const authHeader = request.headers.get("authorization");
    const expectedKey = process.env.ADMIN_API_KEY;

    // If ADMIN_API_KEY is set, require it; otherwise allow in development
    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const specificEventId = searchParams.get("event_id");

    const supabase = createAdminClient();

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
        console.error("Error fetching events:", eventsError);
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
            // Using raw SQL via rpc since the function signature isn't in types yet
            const { error: rpcError } = await supabase.rpc(
              "update_event_popularity" as never,
              { p_event_id: eventId } as never
            );

            if (rpcError) {
              console.error(`Error updating event ${eventId}:`, rpcError);
              results.failed++;
              results.errors.push({
                event_id: eventId,
                error: rpcError.message,
              });
            } else {
              results.success++;
            }
          } catch (err) {
            console.error(`Unexpected error for event ${eventId}:`, err);
            results.failed++;
            results.errors.push({
              event_id: eventId,
              error: err instanceof Error ? err.message : "Unknown error",
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
    console.error("Unexpected error calculating popularity:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/calculate-popularity
 * Get statistics about popularity score calculations
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const expectedKey = process.env.ADMIN_API_KEY;

    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();

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
      console.error("Error fetching stats:", statsError);
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
    console.error("Unexpected error fetching statistics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

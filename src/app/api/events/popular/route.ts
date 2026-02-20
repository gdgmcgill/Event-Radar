/**
 * GET /api/events/popular
 * Get events sorted by popularity or trending score
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transformEventFromDB } from "@/lib/tagMapping";

/**
 * @swagger
 * /api/events/popular:
 *   get:
 *     summary: Get popular or trending events
 *     description: Returns events sorted by popularity_score or trending_score
 *     tags:
 *       - Events
 *     parameters:
 *       - name: sort
 *         in: query
 *         description: Sort by popularity or trending
 *         schema:
 *           type: string
 *           enum: [popularity, trending]
 *           default: popularity
 *       - name: limit
 *         in: query
 *         description: Number of events to return
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *       - name: offset
 *         in: query
 *         description: Offset for pagination
 *         schema:
 *           type: integer
 *           default: 0
 *       - name: min_score
 *         in: query
 *         description: Minimum score threshold
 *         schema:
 *           type: number
 *           default: 0
 *     responses:
 *       200:
 *         description: List of popular events
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sortBy = searchParams.get("sort") || "popularity";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const minScore = parseFloat(searchParams.get("min_score") || "0");

    // Validate sort parameter
    if (sortBy !== "popularity" && sortBy !== "trending") {
      return NextResponse.json(
        { error: "sort must be 'popularity' or 'trending'" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const scoreColumn = sortBy === "trending" ? "trending_score" : "popularity_score";

    // Define types for the joined query
    interface PopularityData {
      popularity_score: number;
      trending_score: number;
    }

    interface EventWithPopularity {
      id: string;
      title: string;
      description: string;
      start_date: string;
      end_date: string | null;
      location: string;
      club_id: string | null;
      tags: string[];
      image_url: string | null;
      status: string;
      created_at: string;
      updated_at: string;
      club: Record<string, unknown> | null;
      popularity: PopularityData[] | null;
    }

    // Query events with their popularity scores
    // We join events with event_popularity_scores
    const { data: eventsData, error: eventsError } = await supabase
      .from("events")
      .select(`
        *,
        club:clubs(*),
        popularity:event_popularity_scores(*)
      `)
      .eq("status", "approved")
      .gte("start_date", new Date().toISOString())
      .order("start_date", { ascending: true });

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    const events = (eventsData || []) as unknown as EventWithPopularity[];

    // Process and sort events by score
    const eventsWithScores = events
      .map((event) => {
        const popularityData = event.popularity?.[0] || null;
        return {
          ...event,
          popularity: popularityData,
          _score: popularityData
            ? (sortBy === "trending"
                ? popularityData.trending_score
                : popularityData.popularity_score)
            : 0,
        };
      })
      .filter((event) => event._score >= minScore)
      .sort((a, b) => b._score - a._score)
      .slice(offset, offset + limit)
      .map(({ _score, ...event }) => {
        const transformed = transformEventFromDB(event as any);
        return {
          ...transformed,
          popularity: event.popularity,
        };
      });

    // Get total count for pagination
    const totalWithScores = events.filter((event) => {
      const score = event.popularity?.[0]
        ? (sortBy === "trending"
            ? event.popularity[0].trending_score
            : event.popularity[0].popularity_score)
        : 0;
      return score >= minScore;
    }).length;

    return NextResponse.json({
      events: eventsWithScores,
      total: totalWithScores,
      limit,
      offset,
      sort: sortBy,
    });
  } catch (error) {
    console.error("Unexpected error fetching popular events:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

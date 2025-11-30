/**
 * GET /api/recommendations
 * Get personalized event recommendations for the current user
 * TODO: Implement recommendation algorithm based on user interests and past events
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const FLASK_BASE_URL = process.env.FLASK_BASE_URL || "http://localhost:5000";
const SAMPLE_USER_TAGS = ["academic", "wellness", "sports"]; // TODO: replace with logged-in user's interest tags

export async function GET(request: NextRequest) {
  try {
    // Fetch events from existing events API
    const eventsRes = await fetch(`${request.nextUrl.origin}/api/events`, {
      cache: "no-store",
    });
    if (!eventsRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      );
    }
    const eventsData = await eventsRes.json();
    const events = Array.isArray(eventsData) ? eventsData : eventsData.events || [];

    // TODO: Use real user context and tags from Supabase auth/profile
    // TODO: When events come from DB, ensure tags align with CATEGORY_ORDER in Flask

    // Score events via Flask
    const scoreRes = await fetch(`${FLASK_BASE_URL}/similarity/events-score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_tags: SAMPLE_USER_TAGS,
        events: events.map((evt: any) => ({ id: evt.id, tags: evt.tags || [] })),
      }),
    });

    if (!scoreRes.ok) {
      return NextResponse.json(
        { error: "Failed to score events" },
        { status: 500 }
      );
    }

    const scoreData = await scoreRes.json();
    const scoreMap: Record<string, number> = {};
    for (const ev of scoreData.events || []) {
      scoreMap[ev.id] = ev.score;
    }

    const recommendations = events
      .map((evt: any) => ({ ...evt, score: scoreMap[evt.id] }))
      .sort((a: any, b: any) => (b.score ?? -1) - (a.score ?? -1));

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}






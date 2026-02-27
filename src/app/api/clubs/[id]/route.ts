/**
 * GET /api/clubs/:id
 * Fetch a single club profile with its upcoming approved events.
 * Public endpoint.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    // Run club fetch, events fetch, and follower count in parallel
    const [clubResult, eventsResult, followerResult] = await Promise.all([
      supabase.from("clubs").select("*").eq("id", clubId).single(),
      supabase
        .from("events")
        .select("*")
        .eq("club_id", clubId)
        .eq("status", "approved")
        .gte("start_date", today)
        .order("start_date", { ascending: true }),
      supabase
        .from("club_followers")
        .select("*", { count: "exact", head: true })
        .eq("club_id", clubId),
    ]);

    const { data: club, error: clubError } = clubResult;
    const { data: events, error: eventsError } = eventsResult;
    const { count: followerCount } = followerResult;

    if (clubError || !club) {
      return NextResponse.json(
        { error: "Club not found" },
        { status: 404 }
      );
    }

    if (eventsError) {
      console.error("Error fetching club events:", eventsError);
      return NextResponse.json({ error: eventsError.message }, { status: 500 });
    }

    return NextResponse.json({
      club,
      events: events ?? [],
      follower_count: followerCount ?? 0,
    });
  } catch (error) {
    console.error("Error in club profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch club" },
      { status: 500 }
    );
  }
}

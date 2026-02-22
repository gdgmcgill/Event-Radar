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

    // Fetch the club
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("*")
      .eq("id", clubId)
      .single();

    if (clubError || !club) {
      return NextResponse.json(
        { error: "Club not found" },
        { status: 404 }
      );
    }

    // Fetch upcoming approved events for this club
    const today = new Date().toISOString().split("T")[0];

    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("*")
      .eq("club_id", clubId)
      .eq("status", "approved")
      .gte("start_date", today)
      .order("start_date", { ascending: true });

    if (eventsError) {
      console.error("Error fetching club events:", eventsError);
      return NextResponse.json({ error: eventsError.message }, { status: 500 });
    }

    return NextResponse.json({ club, events: events ?? [] });
  } catch (error) {
    console.error("Error in club profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch club" },
      { status: 500 }
    );
  }
}

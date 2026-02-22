/**
 * GET /api/clubs/:id/events
 * List events for a specific club (organizer dashboard)
 * Requires: club_organizer with membership for this club, or admin
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
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();

    // Verify authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be signed in" },
        { status: 401 }
      );
    }

    // Get user roles
    const { data: profile } = await supabase
      .from("users")
      .select("roles")
      .eq("id", user.id)
      .single();

    const roles: string[] = profile?.roles ?? [];
    let hasAccess = roles.includes("admin");

    // Club organizer must have membership for this specific club
    if (!hasAccess && roles.includes("club_organizer")) {
      const { data: membership } = await supabase
        .from("club_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("club_id", clubId)
        .single();

      if (membership) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You do not have permission to view this club's events" },
        { status: 403 }
      );
    }

    // Parse query params for optional filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("events")
      .select("*")
      .eq("club_id", clubId)
      .order("start_date", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error("Error fetching club events:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ events: events ?? [] });
  } catch (error) {
    console.error("Error in club events:", error);
    return NextResponse.json(
      { error: "Failed to fetch club events" },
      { status: 500 }
    );
  }
}

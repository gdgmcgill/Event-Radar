/**
 * GET /api/my-clubs
 * List clubs where the authenticated user is a member.
 * Requires auth + club_organizer or admin role.
 * Returns club details with upcoming and pending event counts.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
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

    if (!roles.includes("club_organizer") && !roles.includes("admin")) {
      return NextResponse.json(
        { error: "You do not have permission to access this resource" },
        { status: 403 }
      );
    }

    // Fetch user's club memberships with club details
    const { data: memberships, error: memberError } = await supabase
      .from("club_members")
      .select("id, role, club_id, clubs(*)")
      .eq("user_id", user.id);

    if (memberError) {
      console.error("Error fetching club memberships:", memberError);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ clubs: [] });
    }

    const today = new Date().toISOString().split("T")[0];

    // For each membership, fetch upcoming and pending event counts
    const clubs = await Promise.all(
      memberships.map(async (membership) => {
        const [upcomingResult, pendingResult] = await Promise.all([
          supabase
            .from("events")
            .select("*", { count: "exact", head: true })
            .eq("club_id", membership.club_id)
            .eq("status", "approved")
            .gte("start_date", today),
          supabase
            .from("events")
            .select("*", { count: "exact", head: true })
            .eq("club_id", membership.club_id)
            .eq("status", "pending"),
        ]);

        return {
          membership_id: membership.id,
          membership_role: membership.role,
          club: membership.clubs,
          stats: {
            upcoming_events: upcomingResult.count ?? 0,
            pending_events: pendingResult.count ?? 0,
          },
        };
      })
    );

    return NextResponse.json({ clubs });
  } catch (error) {
    console.error("Error in my-clubs:", error);
    return NextResponse.json(
      { error: "Failed to fetch your clubs" },
      { status: 500 }
    );
  }
}

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/my-clubs
 * Returns the current user's clubs with role and member count.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's memberships
    const { data: memberships, error } = await supabase
      .from("club_members")
      .select("id, role, created_at, club_id")
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch your clubs" },
        { status: 500 }
      );
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ clubs: [] });
    }

    // Fetch club details and member counts in parallel
    const clubIds = memberships.map((m) => m.club_id);

    const [clubsResult, ...countResults] = await Promise.all([
      supabase.from("clubs").select("*").in("id", clubIds),
      ...clubIds.map((clubId) =>
        supabase
          .from("club_members")
          .select("*", { count: "exact", head: true })
          .eq("club_id", clubId)
      ),
    ]);

    const clubMap = new Map(
      (clubsResult.data ?? []).map((c) => [c.id, c])
    );
    const countMap = new Map(
      clubIds.map((id, i) => [id, countResults[i]?.count ?? 0])
    );

    const clubs = memberships.map((membership) => ({
      id: membership.id,
      role: membership.role,
      created_at: membership.created_at,
      club: clubMap.get(membership.club_id) ?? null,
      memberCount: countMap.get(membership.club_id) ?? 0,
    }));

    return NextResponse.json({ clubs });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch your clubs" },
      { status: 500 }
    );
  }
}

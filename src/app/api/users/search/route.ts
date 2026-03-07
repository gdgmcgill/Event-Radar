import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/users/search?q=name — Search users by name
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = request.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    // Search by name (case-insensitive partial match)
    const { data: users, error } = await (supabase as any)
      .from("users")
      .select("id, name, avatar_url, faculty, year")
      .ilike("name", `%${q}%`)
      .neq("id", user.id)
      .limit(20);

    if (error) {
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    // Check follow status for each result
    const { data: following } = await (supabase as any)
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", user.id);

    const { data: followers } = await (supabase as any)
      .from("user_follows")
      .select("follower_id")
      .eq("following_id", user.id);

    const followingSet = new Set((following ?? []).map((f: any) => f.following_id));
    const followerSet = new Set((followers ?? []).map((f: any) => f.follower_id));

    const results = (users ?? []).map((u: any) => ({
      ...u,
      isFollowing: followingSet.has(u.id),
      isFriend: followingSet.has(u.id) && followerSet.has(u.id),
    }));

    return NextResponse.json({ users: results });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

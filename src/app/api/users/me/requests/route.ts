import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/users/me/requests — Returns inbound followers who the current user
 * does NOT follow back (i.e. pending "friend requests").
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

    // Get people who follow the current user
    const { data: inbound } = await (supabase as any)
      .from("user_follows")
      .select("follower_id")
      .eq("following_id", user.id);

    // Get people the current user follows
    const { data: outbound } = await (supabase as any)
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", user.id);

    const outboundSet = new Set(
      (outbound ?? []).map((f: any) => f.following_id)
    );

    // Filter to inbound followers the user hasn't followed back
    const requestIds = (inbound ?? [])
      .map((f: any) => f.follower_id)
      .filter((id: string) => !outboundSet.has(id));

    if (requestIds.length === 0) {
      return NextResponse.json({ requests: [] });
    }

    // Fetch their profiles
    const { data: profiles } = await (supabase as any)
      .from("users")
      .select("id, name, avatar_url, faculty, year")
      .in("id", requestIds)
      .limit(50);

    // Get mutual friends count for each request
    const requests = (profiles ?? []).map((p: any) => ({
      ...p,
      isFollowing: false,
      isFriend: false,
    }));

    return NextResponse.json({ requests });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/events/[id]/friends — Returns friends who saved this event
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    const ctx = await createRequestContext();

    // Anonymous-tolerant: no requireUser. An anonymous caller gets an empty list.
    if (!ctx.user) {
      return NextResponse.json({ friends: [], count: 0 });
    }
    const user = ctx.user;
    const supabase = ctx.supabase;

    // Get friends (mutual follows) who saved this event
    const { data: friends, error } = await supabase.rpc(
      "get_friends_going_to_event",
      { current_user_id: user.id, target_event_id: eventId }
    );

    if (error) {
      // Runs only when the RPC errors; F-071 (a builder passed to .in()) fixed in 04-05.
      const { data: following } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id);
      const followingIds = (following ?? []).map((r) => r.following_id);

      const { data: manualFriends } = await supabase
        .from("saved_events")
        .select("user_id, users!inner(id, name, avatar_url)")
        .eq("event_id", eventId)
        .in("user_id", followingIds);

      // Filter to mutual follows manually
      if (manualFriends) {
        const { data: reverseFollows } = await supabase
          .from("user_follows")
          .select("follower_id")
          .eq("following_id", user.id);

        const reverseSet = new Set(
          (reverseFollows ?? []).map((r: any) => r.follower_id)
        );

        const mutualFriends = manualFriends
          .filter((f: any) => reverseSet.has(f.user_id))
          .map((f: any) => f.users);

        return NextResponse.json({
          friends: mutualFriends,
          count: mutualFriends.length,
        });
      }

      return NextResponse.json({ friends: [], count: 0 });
    }

    return NextResponse.json({
      friends: friends ?? [],
      count: friends?.length ?? 0,
    });
  } catch {
    return NextResponse.json({ friends: [], count: 0 });
  }
}

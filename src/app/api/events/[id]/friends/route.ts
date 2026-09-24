import { NextRequest, NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireUser } from "@/server/authz/requireUser";

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

    // An anonymous caller is told so (401), not handed an empty list (F-028, DEC-39).
    const auth = requireUser(ctx);
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const supabase = ctx.supabase;

    // Get friends (mutual follows) who saved this event
    const { data: friends, error } = await supabase.rpc(
      "get_friends_going_to_event",
      { current_user_id: user.id, target_event_id: eventId }
    );

    if (error) {
      // Runs only when the RPC errors; F-071 (a builder passed to .in()) fixed in 04-05.
      // The fallback degrades to an empty list, never to an error response, so
      // each failure is logged here or it is invisible (WR-02 of the Phase 4
      // code review: F-071's TypeError went unnoticed for exactly that reason).
      console.error("get_friends_going_to_event RPC error, using fallback:", error);

      const { data: following, error: followingError } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id);
      if (followingError) {
        console.error("Friends fallback: user_follows read failed:", followingError);
      }
      const followingIds = (following ?? []).map((r) => r.following_id);

      const { data: manualFriends, error: savedError } = await supabase
        .from("saved_events")
        .select("user_id, users!inner(id, name, avatar_url)")
        .eq("event_id", eventId)
        .in("user_id", followingIds);
      if (savedError) {
        console.error("Friends fallback: saved_events read failed:", savedError);
      }

      // Filter to mutual follows manually
      if (manualFriends) {
        const { data: reverseFollows, error: reverseError } = await supabase
          .from("user_follows")
          .select("follower_id")
          .eq("following_id", user.id);
        if (reverseError) {
          console.error("Friends fallback: reverse user_follows read failed:", reverseError);
        }

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
  } catch (error) {
    console.error("Error fetching friends going to event:", error);
    return NextResponse.json({ friends: [], count: 0 });
  }
}

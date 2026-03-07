import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/events/[id]/friends — Returns friends who saved this event
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ friends: [], count: 0 });
    }

    // Get friends (mutual follows) who saved this event
    const { data: friends, error } = await (supabase as any).rpc(
      "get_friends_going_to_event",
      { current_user_id: user.id, target_event_id: eventId }
    );

    if (error) {
      // Fallback: manual query if RPC doesn't exist yet
      const { data: manualFriends } = await (supabase as any)
        .from("saved_events")
        .select("user_id, users!inner(id, name, avatar_url)")
        .eq("event_id", eventId)
        .in(
          "user_id",
          (supabase as any)
            .from("user_follows")
            .select("following_id")
            .eq("follower_id", user.id)
        );

      // Filter to mutual follows manually
      if (manualFriends) {
        const { data: reverseFollows } = await (supabase as any)
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

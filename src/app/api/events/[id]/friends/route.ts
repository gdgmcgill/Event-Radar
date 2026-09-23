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
      // Fallback: manual query if RPC doesn't exist yet
      const { data: manualFriends } = await supabase
        .from("saved_events")
        .select("user_id, users!inner(id, name, avatar_url)")
        .eq("event_id", eventId)
        .in(
          "user_id",
          // DEFECT F-071 — a query builder is passed where an array of ids is
          // required. `.in()` calls `Array.from(new Set(values))` on this
          // argument and a builder is not iterable, so this throws and the
          // handler's outer catch returns an empty friends list. The client
          // cast below is one of only two left under src/ and it is retained
          // deliberately: removing it makes the tree fail to type-check, and the
          // only way to make it compile is to change the behaviour — which
          // belongs to the slice that owns this path, not to a typing plan.
          // Characterized by src/__tests__/api/events/friends-defect.test.ts.
          // Closes in Phase 4. See evidence/type-fixes-note.md.
          (supabase as any)
            .from("user_follows")
            .select("following_id")
            .eq("follower_id", user.id)
        );

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

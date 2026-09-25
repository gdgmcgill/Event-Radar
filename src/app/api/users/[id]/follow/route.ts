import { NextRequest, NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { getElevatedClient } from "@/server/db/elevated";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/users/[id]/follow — Follow a user
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    const { id: targetId } = await params;

    if (user.id === targetId) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    // Insert follow. ON CONFLICT DO NOTHING RETURNING yields a row only when
    // the follow is new, which is what gates the notifications below.
    const { data: inserted, error } = await supabase
      .from("user_follows")
      .upsert(
        { follower_id: user.id, following_id: targetId },
        { onConflict: "follower_id,following_id", ignoreDuplicates: true }
      )
      .select("id");

    if (error) {
      return NextResponse.json({ error: "Failed to follow user" }, { status: 500 });
    }

    const isNewFollow = (inserted?.length ?? 0) > 0;

    // Check if mutual follow (friendship)
    const { data: reverseFollow } = await supabase
      .from("user_follows")
      .select("id")
      .eq("follower_id", targetId)
      .eq("following_id", user.id)
      .maybeSingle();

    const isFriend = !!reverseFollow;

    // A repeat follow changes nothing, so it notifies nobody (REVIEW-05 iter3
    // WR-05). Rows without an event_id fall outside notifications_dedup_idx,
    // so before this check every repeated call delivered another "started
    // following you" (or two "New Friend!" rows). The body is unchanged.
    if (!isNewFollow) {
      return NextResponse.json({ following: true, isFriend }, { status: 201 });
    }

    // Fetch target user name for notification
    const { data: targetUser } = await supabase
      .from("users")
      .select("name")
      .eq("id", targetId)
      .single();

    const { data: currentUser } = await supabase
      .from("users")
      .select("name")
      .eq("id", user.id)
      .single();

    const followerName = currentUser?.name ?? "Someone";

    // notifications INSERT is granted to service_role only, so on the cookie
    // client these never delivered (REVIEW-05 WR-10). A failed notification
    // does not undo the follow, but it is logged. REGISTRY.md row: "Notify
    // another user (notifications insert)".
    const notifications = isFriend
      ? [
          // Notify both users about the new friendship
          {
            user_id: targetId,
            type: "new_friend",
            title: "New Friend!",
            message: `You and ${followerName} are now friends.`,
          },
          {
            user_id: user.id,
            type: "new_friend",
            title: "New Friend!",
            message: `You and ${targetUser?.name ?? "someone"} are now friends.`,
          },
        ]
      : [
          // Notify target about the new follower
          {
            user_id: targetId,
            type: "new_follower",
            title: "New Follower",
            message: `${followerName} started following you.`,
          },
        ];

    const { error: notifyError } = await getElevatedClient()
      .from("notifications")
      .insert(notifications);
    if (notifyError) {
      console.error("Error inserting follow notifications:", notifyError);
    }

    return NextResponse.json({ following: true, isFriend }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to follow user" }, { status: 500 });
  }
}

/**
 * DELETE /api/users/[id]/follow — Unfollow a user
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    const { id: targetId } = await params;

    const { error } = await supabase
      .from("user_follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetId);

    if (error) {
      return NextResponse.json({ error: "Failed to unfollow user" }, { status: 500 });
    }

    return NextResponse.json({ following: false, isFriend: false });
  } catch {
    return NextResponse.json({ error: "Failed to unfollow user" }, { status: 500 });
  }
}

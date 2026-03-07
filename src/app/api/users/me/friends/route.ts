import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/users/me/friends — Returns the current user's friends (mutual follows)
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

    const { data: friends, error } = await (supabase as any).rpc("get_friends", {
      target_user_id: user.id,
    });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch friends" }, { status: 500 });
    }

    return NextResponse.json({ friends: friends ?? [] });
  } catch {
    return NextResponse.json({ error: "Failed to fetch friends" }, { status: 500 });
  }
}

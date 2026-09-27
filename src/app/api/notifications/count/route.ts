import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireUser } from "@/server/authz/requireUser";

/**
 * GET /api/notifications/count - Lightweight unread count only
 *
 * An anonymous caller, or one whose session lookup failed, answers
 * 401 {"error":"Unauthorized"} like every other protected read (F-028,
 * DEC-69, INTENTIONAL BEHAVIOUR CHANGE: it answered 200 {"unread_count":0}).
 * The navigation requests the count only for a signed-in user, so anonymous
 * pages do not poll it.
 */
export async function GET() {
  try {
    const ctx = await createRequestContext();
    const auth = requireUser(ctx);
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const { count } = await ctx.supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false);

    return NextResponse.json({ unread_count: count || 0 });
  } catch {
    return NextResponse.json({ unread_count: 0 });
  }
}

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { logRouteError, withRoute } from "@/server/route";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/clubs/[id]/follow
 * Returns whether the current user follows this club.
 */
export const GET = withRoute({ cache: "private", action: "check follow status" }, async (_request: NextRequest, { params }: RouteParams) => {
  try {
    const { id: clubId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await supabase
      .from("club_followers")
      .select("id")
      .eq("user_id", user.id)
      .eq("club_id", clubId)
      .maybeSingle();

    return NextResponse.json({ following: !!data });
  } catch (error) {
    logRouteError(error);
    return NextResponse.json(
      { error: "Failed to check follow status" },
      { status: 500 }
    );
  }
});

/**
 * POST /api/clubs/[id]/follow
 * Follow a club.
 */
export const POST = withRoute({ cache: "private", action: "follow club" }, async (_request: NextRequest, { params }: RouteParams) => {
  try {
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    const { id: clubId } = await params;

    const { error } = await supabase.from("club_followers").upsert(
      { user_id: user.id, club_id: clubId },
      { onConflict: "user_id,club_id", ignoreDuplicates: true }
    );

    if (error) {
      logRouteError(error);
      return NextResponse.json(
        { error: "Failed to follow club" },
        { status: 500 }
      );
    }

    return NextResponse.json({ following: true }, { status: 201 });
  } catch (error) {
    logRouteError(error);
    return NextResponse.json(
      { error: "Failed to follow club" },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/clubs/[id]/follow
 * Unfollow a club.
 */
export const DELETE = withRoute({ cache: "private", action: "unfollow club" }, async (_request: NextRequest, { params }: RouteParams) => {
  try {
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    const { id: clubId } = await params;

    const { error } = await supabase
      .from("club_followers")
      .delete()
      .eq("user_id", user.id)
      .eq("club_id", clubId);

    if (error) {
      logRouteError(error);
      return NextResponse.json(
        { error: "Failed to unfollow club" },
        { status: 500 }
      );
    }

    return NextResponse.json({ following: false });
  } catch (error) {
    logRouteError(error);
    return NextResponse.json(
      { error: "Failed to unfollow club" },
      { status: 500 }
    );
  }
});

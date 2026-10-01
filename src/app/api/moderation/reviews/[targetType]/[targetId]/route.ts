import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getElevatedClient } from "@/server/db/elevated";
import { hasRole } from "@/lib/roles";
import { createRequestContext } from "@/server/context";
import { requireUser } from "@/server/authz/requireUser";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { parseWith } from "@/server/body";
import { ReviewTargetParams } from "@/contracts/admin";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

export const GET = withRoute({ cache: "private", action: "fetch moderation reviews" }, async (
  _request: NextRequest,
  { params }: { params: Promise<{ targetType: string; targetId: string }> }
) => {
  const ctx = await createRequestContext();
  const auth = requireUser(ctx);
  if (!auth.ok) return auth.response;
  const user = auth.user;

  // "Invalid target type" unless event or club; the id is used as sent.
  const target = parseWith(ReviewTargetParams, await params);
  if (!target.ok) return target.response;
  const { targetType, targetId } = target.data;

  // The target read and the review listing run on the caller's cookie client:
  // "Anyone can read clubs", "Organizers can view own events", "Admins can
  // view all events", and on moderation_reviews "Creators can view reviews of
  // their items" and "Admins full access" (DEC-49). Only the author-name
  // enrichment goes through the elevated door.
  const supabase = ctx.supabase;

  // The admin decision reads the request context's profile slice, the same
  // one read every admin guard uses; the creator path below is unchanged.
  const isAdmin = ctx.profile !== null && hasRole(ctx.profile, "admin");

  // The admin path runs the active-user guard before the role takes effect
  // (DI-55, DEC-79): a banned admin gets the seam's 403 "Account suspended"
  // instead of every review. The creator path below is unchanged.
  if (isAdmin) {
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
  }

  if (!isAdmin) {
    const table = targetType === "event" ? "events" : "clubs";
    const { data: item } = await supabase
      .from(table)
      .select("created_by")
      .eq("id", targetId)
      .single();

    if (!item || item.created_by !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: reviews, error } = await supabase
    .from("moderation_reviews")
    .select("*")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: true });

  if (error) {
    log.error("Failed to fetch moderation reviews", { targetType, targetId, error });
    return NextResponse.json(
      { error: "Failed to fetch moderation reviews" },
      { status: 500 }
    );
  }

  const authorIds = [...new Set((reviews ?? []).map((r) => r.author_id))];
  let authorMap: Record<string, string> = {};
  if (authorIds.length > 0) {
    // The authors are admins and the creator; a creator cannot read an
    // admin's users row. REGISTRY.md row: "Read another user's name for
    // appeals and review listings".
    const { data: authors } = await getElevatedClient()
      .from("users")
      .select("id, name, email")
      .in("id", authorIds);

    if (authors) {
      authorMap = Object.fromEntries(
        authors.map((a) => [a.id, a.name || a.email?.split("@")[0] || "Unknown"])
      );
    }
  }

  const enrichedReviews = (reviews ?? []).map((r) => ({
    ...r,
    author_name: authorMap[r.author_id] ?? "Unknown",
  }));

  return NextResponse.json({ reviews: enrichedReviews });
});

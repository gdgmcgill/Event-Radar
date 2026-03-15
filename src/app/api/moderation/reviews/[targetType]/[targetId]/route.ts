import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ targetType: string; targetId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { targetType, targetId } = await params;

  if (!["event", "club"].includes(targetType)) {
    return NextResponse.json({ error: "Invalid target type" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const { data: profile } = await serviceClient
    .from("users")
    .select("roles")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.roles?.includes("admin");

  if (!isAdmin) {
    const table = targetType === "event" ? "events" : "clubs";
    const { data: item } = await serviceClient
      .from(table)
      .select("created_by")
      .eq("id", targetId)
      .single();

    if (!item || item.created_by !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: reviews, error } = await serviceClient
    .from("moderation_reviews")
    .select("*")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const authorIds = [...new Set((reviews ?? []).map((r) => r.author_id))];
  let authorMap: Record<string, string> = {};
  if (authorIds.length > 0) {
    const { data: authors } = await serviceClient
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
}

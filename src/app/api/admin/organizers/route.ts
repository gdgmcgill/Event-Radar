import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const { isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "all";

  const supabase = createServiceClient();

  // Query users with club_organizer role
  let query = supabase
    .from("users")
    .select("id, name, email, avatar_url, roles, created_at, banned_at, ban_expires_at, ban_reason")
    .contains("roles", ["club_organizer"]);

  // Search filter
  if (search.trim()) {
    const sanitized = search.replace(/[,()]/g, "").trim();
    if (sanitized) {
      query = query.or(
        `name.ilike.%${sanitized}%,email.ilike.%${sanitized}%`
      );
    }
  }

  // Status filter
  if (status === "banned") {
    query = query
      .not("banned_at", "is", null)
      .or(
        `ban_expires_at.is.null,ban_expires_at.gt.${new Date().toISOString()}`
      );
  } else if (status === "active") {
    query = query.is("banned_at", null);
  }

  const { data: organizers, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!organizers || organizers.length === 0) {
    return NextResponse.json({ organizers: [] });
  }

  const organizerIds = organizers.map((o) => o.id);

  // Get clubs owned by these organizers
  const { data: clubMemberships } = await supabase
    .from("club_members")
    .select("user_id, club_id, clubs(id, name)")
    .in("user_id", organizerIds)
    .eq("role", "owner");

  // Get event counts per organizer
  const { data: eventCounts } = await supabase
    .from("events")
    .select("created_by")
    .in("created_by", organizerIds);

  // Build lookup maps
  const clubsByUser = new Map<string, { id: string; name: string }[]>();
  if (clubMemberships) {
    for (const m of clubMemberships) {
      const clubs = clubsByUser.get(m.user_id) ?? [];
      const club = m.clubs as unknown as { id: string; name: string } | null;
      if (club) {
        clubs.push({ id: club.id, name: club.name });
      }
      clubsByUser.set(m.user_id, clubs);
    }
  }

  const eventCountByUser = new Map<string, number>();
  if (eventCounts) {
    for (const e of eventCounts) {
      eventCountByUser.set(
        e.created_by,
        (eventCountByUser.get(e.created_by) ?? 0) + 1
      );
    }
  }

  // Merge results
  const result = organizers.map((o) => ({
    ...o,
    clubs: clubsByUser.get(o.id) ?? [],
    event_count: eventCountByUser.get(o.id) ?? 0,
  }));

  return NextResponse.json({ organizers: result });
}

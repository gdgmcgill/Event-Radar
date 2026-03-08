import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";

export async function GET() {
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [events, pending, approved, users, lastUpdated, engagedUsers] =
    await Promise.all([
      supabase.from("events").select("id", { count: "exact", head: true }),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved"),
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .gte("updated_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .gte("saved_events_count", 3),
    ]);

  return NextResponse.json({
    totalEvents: events.count ?? 0,
    pendingEvents: pending.count ?? 0,
    approvedEvents: approved.count ?? 0,
    totalUsers: users.count ?? 0,
    engagedUsers: engagedUsers.count ?? 0,
    lastUpdated: lastUpdated.count ?? 0,
  });
}

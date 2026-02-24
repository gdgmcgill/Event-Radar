import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";

export async function GET() {
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [events, pending, approved, users] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("users").select("id", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    totalEvents: events.count ?? 0,
    pendingEvents: pending.count ?? 0,
    approvedEvents: approved.count ?? 0,
    totalUsers: users.count ?? 0,
  });
}

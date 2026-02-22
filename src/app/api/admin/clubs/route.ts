import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";

export async function GET() {
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Since there's no clubs table, aggregate organizers from events
  const { data, error } = await supabase
    .from("events")
    .select("organizer, status");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by organizer
  const organizerMap = new Map<
    string,
    { total: number; approved: number; pending: number; rejected: number }
  >();

  for (const event of data ?? []) {
    const name = event.organizer || "Unknown";
    const existing = organizerMap.get(name) || {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
    };
    existing.total++;
    if (event.status === "approved") existing.approved++;
    else if (event.status === "pending") existing.pending++;
    else if (event.status === "rejected") existing.rejected++;
    organizerMap.set(name, existing);
  }

  const clubs = Array.from(organizerMap.entries())
    .map(([name, counts]) => ({ name, ...counts }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({ clubs });
}

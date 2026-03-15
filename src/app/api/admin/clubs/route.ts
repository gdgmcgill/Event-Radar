import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";

export async function GET(request: NextRequest) {
  const { supabase, user, isAdmin } = await verifyAdmin();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") || "pending";

  let query = supabase
    .from("clubs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status as "pending" | "approved" | "rejected");
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching admin clubs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ clubs: data ?? [], total: count ?? 0 });
}

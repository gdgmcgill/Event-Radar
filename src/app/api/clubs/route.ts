import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/clubs
 * Public endpoint - returns all approved clubs.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: clubs, error } = await supabase
      .from("clubs")
      .select("*")
      .eq("status", "approved")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch clubs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ clubs: clubs ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch clubs" },
      { status: 500 }
    );
  }
}

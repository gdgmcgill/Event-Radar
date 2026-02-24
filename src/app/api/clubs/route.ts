/**
 * GET /api/clubs
 * List all approved clubs ordered by name. Public endpoint.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: clubs, error } = await supabase
      .from("clubs")
      .select("*")
      .eq("status", "approved")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching clubs:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ clubs: clubs ?? [] });
  } catch (error) {
    console.error("Error in clubs list:", error);
    return NextResponse.json(
      { error: "Failed to fetch clubs" },
      { status: 500 }
    );
  }
}

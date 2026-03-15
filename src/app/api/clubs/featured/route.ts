import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from("featured_clubs")
      .select("*, club:clubs(*)")
      .lte("starts_at", new Date().toISOString())
      .gt("ends_at", new Date().toISOString())
      .order("priority", { ascending: false })
      .order("starts_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const featured = (data ?? []).filter(
      (row: any) => row.club && row.club.status === "approved"
    );

    return NextResponse.json({ featured });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch featured clubs" },
      { status: 500 }
    );
  }
}

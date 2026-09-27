import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

export const GET = withRoute({ cache: "public-60-120", action: "fetch featured clubs" }, async () => {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("featured_clubs")
      .select("*, club:clubs(*)")
      .lte("starts_at", new Date().toISOString())
      .gt("ends_at", new Date().toISOString())
      .order("priority", { ascending: false })
      .order("starts_at", { ascending: true });

    if (error) {
      log.error("Failed to fetch featured clubs", { error });
      return NextResponse.json(
        { error: "Failed to fetch featured clubs" },
        { status: 500 }
      );
    }

    const featured = (data ?? []).filter(
      (row: any) => row.club && row.club.status === "approved"
    );

    // The public-60-120 class (withRoute above) sends the header this
    // response set itself before 06-13, byte for byte.
    return NextResponse.json({ featured });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch featured clubs" },
      { status: 500 }
    );
  }
});

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logRouteError, withRoute } from "@/server/route";
import { log } from "@/server/log";

export const GET = withRoute({ cache: "public-60-120", action: "fetch featured events" }, async () => {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("featured_events")
      .select("*, event:events(*)")
      .lte("starts_at", new Date().toISOString())
      .gt("ends_at", new Date().toISOString())
      .order("priority", { ascending: false })
      .order("starts_at", { ascending: true });

    if (error) {
      log.error("Failed to fetch featured events", { error });
      return NextResponse.json(
        { error: "Failed to fetch featured events" },
        { status: 500 }
      );
    }

    // Filter out entries where the joined event is missing, not approved, or soft-deleted
    const featured = (data ?? []).filter(
      (row: any) => row.event && row.event.status === "approved" && row.event.deleted_at === null
    );

    // The public-60-120 class (withRoute above) sends the header this
    // response set itself before 06-14, byte for byte.
    return NextResponse.json({ featured });
  } catch (error) {
    logRouteError(error);
    return NextResponse.json(
      { error: "Failed to fetch featured events" },
      { status: 500 }
    );
  }
});

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

export const GET = withRoute({ cache: "private", action: "fetch your events" }, async () => {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: events, error } = await supabase
    .from("events")
    .select("*, club:clubs(id, name, logo_url)")
    .eq("created_by", user.id)
    .is("deleted_at", null)
    .order("start_date", { ascending: true });

  if (error) {
    log.error("Failed to fetch your events", { error });
    return NextResponse.json({ error: "Failed to fetch your events" }, { status: 500 });
  }

  return NextResponse.json({ events: events ?? [] });
});

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";

export async function GET(request: NextRequest) {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;

  const url = request.nextUrl;
  const status = url.searchParams.get("status");
  const eventId = url.searchParams.get("event_id");
  const rawLimit = parseInt(url.searchParams.get("limit") || "50");
  const limit = isNaN(rawLimit) || rawLimit < 0 ? 50 : Math.min(rawLimit, 100);
  const rawOffset = parseInt(url.searchParams.get("offset") || "0");
  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

  // "Admins can read all reports", "Admins can view all events" and "Admins
  // can view all profiles" permit every read here on the cookie client, so no
  // elevated client is needed (DEC-49).
  const supabase = ctx.supabase;

  // No reporter embed: event_reports.reporter_id references auth.users, not
  // public.users, so an embed of users hinted by the reporter foreign key
  // failed with PGRST200 and the route always answered 500 (F-092, DEC-69).
  // The reporters are read separately below.
  let query = supabase
    .from("event_reports")
    .select(`
      *,
      event:events!inner(id, title, status, deleted_at)
    `)
    .is("event.deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  if (eventId) {
    query = query.eq("event_id", eventId);
  }

  const { data: reports, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Compute accurate report_count per event via a separate query
  const eventIds = [...new Set((reports || []).map((r: any) => r.event_id))];
  const eventCounts: Record<string, number> = {};

  if (eventIds.length > 0) {
    const { data: countRows } = await supabase
      .from("event_reports")
      .select("event_id")
      .in("event_id", eventIds)
      .eq("status", "pending");

    if (countRows) {
      for (const row of countRows) {
        eventCounts[row.event_id] = (eventCounts[row.event_id] || 0) + 1;
      }
    }
  }

  // Each report's reporter, read from public.users ("Admins can view all
  // profiles") and mapped to the shape the moderation page renders:
  // { id, display_name, avatar_url }, or null when there is no such profile.
  // Only id, name and avatar_url are selected; no email leaves this route.
  const reporterIds = [
    ...new Set(
      (reports || [])
        .map((r: any) => r.reporter_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const reporters = new Map<
    string,
    { id: string; display_name: string | null; avatar_url: string | null }
  >();

  if (reporterIds.length > 0) {
    const { data: reporterRows } = await supabase
      .from("users")
      .select("id, name, avatar_url")
      .in("id", reporterIds);

    for (const row of reporterRows ?? []) {
      reporters.set(row.id, {
        id: row.id,
        display_name: row.name,
        avatar_url: row.avatar_url,
      });
    }
  }

  const enriched = (reports || []).map((r: any) => ({
    ...r,
    reporter: reporters.get(r.reporter_id) ?? null,
    report_count: eventCounts[r.event_id] || 1,
  }));

  return NextResponse.json({ reports: enriched });
}

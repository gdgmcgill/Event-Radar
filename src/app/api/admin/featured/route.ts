import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { logAdminAction } from "@/lib/audit";
import { parseBody } from "@/server/body";
import { FeaturedCreateBody } from "@/contracts/admin";
import { getESTNowISO } from "@/lib/timezone";
import { logRouteError, withRoute } from "@/server/route";
import { log } from "@/server/log";

export const GET = withRoute({ cache: "private", action: "fetch featured events" }, async () => {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const supabase = ctx.supabase;

  try {
    const { data, error } = await supabase
      .from("featured_events")
      .select("*, event:events(id, title, image_url, start_date, status)")
      .order("ends_at", { ascending: false });

    if (error) {
      logRouteError(error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const now = getESTNowISO();
    const active = (data ?? []).filter(
      (r: any) => r.starts_at <= now && r.ends_at > now
    );
    const upcoming = (data ?? []).filter((r: any) => r.starts_at > now);
    const expired = (data ?? []).filter((r: any) => r.ends_at <= now);

    return NextResponse.json({ active, upcoming, expired });
  } catch (error) {
    logRouteError(error);
    return NextResponse.json(
      { error: "Failed to fetch featured events" },
      { status: 500 }
    );
  }
});

export const POST = withRoute({ cache: "private", action: "create featured event" }, async (request: NextRequest) => {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const supabase = ctx.supabase;

  try {
    // The three required keys, then the sponsor name, sanitized when truthy
    // and null otherwise (src/contracts/admin.ts).
    const parsed = await parseBody(request, FeaturedCreateBody);
    if (!parsed.ok) return parsed.response;
    const { event_id, priority, starts_at, ends_at, sponsor_name } =
      parsed.data;

    const { data, error } = await supabase
      .from("featured_events")
      .insert({
        event_id,
        sponsor_name,
        priority: priority ?? 0,
        starts_at,
        ends_at,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This event already has an active or upcoming featured entry" },
          { status: 409 }
        );
      }
      logRouteError(error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    try {
      await logAdminAction({
        adminUserId: user.id,
        requestId: ctx.requestId,
        action: "created",
        targetType: "featured_event",
        targetId: data.id,
        metadata: { event_id, sponsor_name, starts_at, ends_at },
      });
    } catch (auditErr) {
      log.error("Failed to log audit action", { scope: "Admin", error: auditErr });
    }

    return NextResponse.json({ featured: data }, { status: 201 });
  } catch (error) {
    logRouteError(error);
    return NextResponse.json(
      { error: "Failed to create featured event" },
      { status: 500 }
    );
  }
});

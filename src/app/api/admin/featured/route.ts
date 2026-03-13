import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { sanitizeText } from "@/lib/sanitize";
import { logAdminAction } from "@/lib/audit";

export async function GET() {
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { data, error } = await supabase
      .from("featured_events")
      .select("*, event:events(id, title, image_url, event_date, event_time, status)")
      .order("ends_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const now = new Date().toISOString();
    const active = (data ?? []).filter(
      (r: any) => r.starts_at <= now && r.ends_at > now
    );
    const upcoming = (data ?? []).filter((r: any) => r.starts_at > now);
    const expired = (data ?? []).filter((r: any) => r.ends_at <= now);

    return NextResponse.json({ active, upcoming, expired });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch featured events" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { supabase, user, isAdmin } = await verifyAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { event_id, priority, starts_at, ends_at } = body;

    if (!event_id || !starts_at || !ends_at) {
      return NextResponse.json(
        { error: "event_id, starts_at, and ends_at are required" },
        { status: 400 }
      );
    }

    const sponsor_name = body.sponsor_name
      ? sanitizeText(body.sponsor_name)
      : null;

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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      await logAdminAction({
        adminUserId: user.id,
        adminEmail: user.email,
        action: "created",
        targetType: "featured_event",
        targetId: data.id,
        metadata: { event_id, sponsor_name, starts_at, ends_at },
      });
    } catch (auditErr) {
      console.error("[Admin] Failed to log audit action:", auditErr);
    }

    return NextResponse.json({ featured: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create featured event" },
      { status: 500 }
    );
  }
}

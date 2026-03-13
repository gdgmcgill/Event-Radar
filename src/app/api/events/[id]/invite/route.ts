import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/events/[id]/invite — Invite friends to an event
 * Body: { invitee_ids: string[] }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const inviteeIds: string[] = body.invitee_ids;

    if (!Array.isArray(inviteeIds) || inviteeIds.length === 0) {
      return NextResponse.json({ error: "No invitees provided" }, { status: 400 });
    }

    // Verify each invitee is a friend (mutual follow)
    const { data: friends } = await (supabase as any).rpc("get_friends", {
      target_user_id: user.id,
    });

    const friendIds = new Set((friends ?? []).map((f: any) => f.id));
    const validInvitees = inviteeIds.filter((id) => friendIds.has(id));

    if (validInvitees.length === 0) {
      return NextResponse.json({ error: "No valid friends to invite" }, { status: 400 });
    }

    // Get event title for notification
    const { data: event } = await (supabase as any)
      .from("events")
      .select("title")
      .eq("id", eventId)
      .single();

    // Get inviter name
    const { data: inviter } = await (supabase as any)
      .from("users")
      .select("name")
      .eq("id", user.id)
      .single();

    const inviterName = inviter?.name ?? "Someone";
    const eventTitle = event?.title ?? "an event";

    // Insert invites (ignore duplicates)
    const inviteRows = validInvitees.map((inviteeId) => ({
      inviter_id: user.id,
      invitee_id: inviteeId,
      event_id: eventId,
    }));

    await (supabase as any)
      .from("event_invites")
      .upsert(inviteRows, {
        onConflict: "inviter_id,invitee_id,event_id",
        ignoreDuplicates: true,
      });

    // Create notifications for each invitee
    const notifications = validInvitees.map((inviteeId) => ({
      user_id: inviteeId,
      type: "event_invite",
      title: "Event Invitation",
      message: `${inviterName} invited you to "${eventTitle}"`,
      event_id: eventId,
    }));

    await supabase.from("notifications").insert(notifications);

    return NextResponse.json({ sent: validInvitees.length });
  } catch {
    return NextResponse.json({ error: "Failed to send invites" }, { status: 500 });
  }
}

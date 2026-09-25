import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { getElevatedClient } from "@/server/db/elevated";
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
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    const { id: eventId } = await params;

    const body = await request.json();
    const inviteeIds: string[] = body.invitee_ids;

    if (!Array.isArray(inviteeIds) || inviteeIds.length === 0) {
      return NextResponse.json({ error: "No invitees provided" }, { status: 400 });
    }

    // Verify each invitee is a friend (mutual follow)
    const { data: friends } = await supabase.rpc("get_friends", {
      target_user_id: user.id,
    });

    const friendIds = new Set((friends ?? []).map((f: any) => f.id));
    const validInvitees = inviteeIds.filter((id) => friendIds.has(id));

    if (validInvitees.length === 0) {
      return NextResponse.json({ error: "No valid friends to invite" }, { status: 400 });
    }

    // Get event title for notification
    const { data: event } = await supabase
      .from("events")
      .select("title")
      .eq("id", eventId)
      .single();

    // Get inviter name
    const { data: inviter } = await supabase
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

    // The invite rows are the record: if they were not written, nothing was
    // sent (REVIEW-05 WR-10). The returned rows are the NEW invites only
    // (ON CONFLICT DO NOTHING returns no row for an existing invite).
    const { data: inserted, error: inviteError } = await supabase
      .from("event_invites")
      .upsert(inviteRows, {
        onConflict: "inviter_id,invitee_id,event_id",
        ignoreDuplicates: true,
      })
      .select("invitee_id");

    if (inviteError) {
      console.error("Error inserting event invites:", inviteError);
      return NextResponse.json({ error: "Failed to send invites" }, { status: 500 });
    }

    // Notify only the newly invited: an existing invite already notified its
    // invitee, and notifications_dedup_idx (user_id, event_id, type) would
    // refuse the whole batch on a repeat. notifications INSERT is granted to
    // service_role only, so on the cookie client these never delivered.
    // REGISTRY.md row: "Notify another user (notifications insert)".
    const newlyInvited = (inserted ?? []).map((row) => row.invitee_id);
    if (newlyInvited.length > 0) {
      const notifications = newlyInvited.map((inviteeId) => ({
        user_id: inviteeId,
        type: "event_invite",
        title: "Event Invitation",
        message: `${inviterName} invited you to "${eventTitle}"`,
        event_id: eventId,
      }));

      const { error: notifyError } = await getElevatedClient()
        .from("notifications")
        .insert(notifications);
      if (notifyError) {
        console.error("Error inserting invite notifications:", notifyError);
      }
    }

    // Every valid invitee now holds an invite (new or pre-existing).
    return NextResponse.json({ sent: validInvitees.length });
  } catch {
    return NextResponse.json({ error: "Failed to send invites" }, { status: 500 });
  }
}

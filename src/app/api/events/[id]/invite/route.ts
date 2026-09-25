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
    // invitee. notifications INSERT is granted to service_role only, so on
    // the cookie client these never delivered. REGISTRY.md row: "Notify
    // another user (notifications insert)".
    //
    // One insert per invitee (REVIEW-05 iter3 WR-03). A new invite row can
    // still meet an existing notification: notifications_dedup_idx is
    // (user_id, event_id, type) and ignores the inviter, so a second inviter,
    // or a re-invite after the invitee deleted the invite, collides with
    // 23505. In a single multi-row INSERT that one collision dropped every
    // notification in the batch. PostgREST's on_conflict cannot name the
    // partial index, so each row is inserted on its own.
    const newlyInvited = (inserted ?? []).map((row) => row.invitee_id);
    if (newlyInvited.length > 0) {
      const elevated = getElevatedClient();
      const results = await Promise.all(
        newlyInvited.map((inviteeId) =>
          elevated.from("notifications").insert({
            user_id: inviteeId,
            type: "event_invite",
            title: "Event Invitation",
            message: `${inviterName} invited you to "${eventTitle}"`,
            event_id: eventId,
          })
        )
      );
      results.forEach(({ error: notifyError }, index) => {
        // 23505: this invitee already holds an event_invite notification
        // for this event, so they are notified; not a failure.
        if (!notifyError || notifyError.code === "23505") return;
        console.error(
          `Error inserting invite notifications (row ${index + 1} of ${results.length}):`,
          notifyError
        );
      });
    }

    // Every valid invitee now holds an invite (new or pre-existing).
    return NextResponse.json({ sent: validInvitees.length });
  } catch {
    return NextResponse.json({ error: "Failed to send invites" }, { status: 500 });
  }
}

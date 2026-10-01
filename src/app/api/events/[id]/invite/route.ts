import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { getElevatedClient } from "@/server/db/elevated";
import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "@/server/body";
import { EventInviteBody } from "@/contracts/events";
import { logRouteError, withRoute } from "@/server/route";
import { log } from "@/server/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/events/[id]/invite — Invite friends to an event
 * Body: { invitee_ids: string[] }
 */
export const POST = withRoute({ cache: "private", action: "send invites" }, async (request: NextRequest, { params }: RouteParams) => {
  try {
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    const { id: eventId } = await params;

    // The contract (plan 06-08, REFAC-15): "No invitees provided" unless
    // invitee_ids is a non-empty array. F-094: a non-JSON or non-object body
    // is a 400 (INTENTIONAL BEHAVIOUR CHANGE).
    const parsed = await parseBody(request, EventInviteBody);
    if (!parsed.ok) return parsed.response;
    const inviteeIds = parsed.data.invitee_ids;

    // Verify each invitee is a friend (mutual follow)
    const { data: friends } = await supabase.rpc("get_friends", {
      target_user_id: user.id,
    });

    const friendIds = new Set((friends ?? []).map((f: any) => f.id));
    // Every friend id is a string, so a kept element is one.
    const validInvitees = inviteeIds.filter((id): id is string =>
      friendIds.has(id)
    );

    if (validInvitees.length === 0) {
      return NextResponse.json({ error: "No valid friends to invite" }, { status: 400 });
    }

    // Only a live, approved event can be shared (REVIEW-05 iter3 WR-04). The
    // notification goes out on the elevated door, so without this gate a
    // creator could carry an unmoderated pending or rejected title to their
    // friends, and anyone could invite friends to an event id they cannot
    // see (someone else's pending event, or a soft-deleted one). Checked
    // before any invite row is written.
    const { data: event } = await supabase
      .from("events")
      .select("title")
      .eq("id", eventId)
      .eq("status", "approved")
      .is("deleted_at", null)
      .maybeSingle();

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Get inviter name
    const { data: inviter } = await supabase
      .from("users")
      .select("name")
      .eq("id", user.id)
      .single();

    const inviterName = inviter?.name ?? "Someone";
    const eventTitle = event.title;

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
      log.error("Error inserting event invites", { error: inviteError });
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
        log.error("Error inserting invite notifications", {
          eventId,
          row: index + 1,
          of: results.length,
          error: notifyError,
        });
      });
    }

    // Every valid invitee now holds an invite (new or pre-existing).
    return NextResponse.json({ sent: validInvitees.length });
  } catch (error) {
    logRouteError(error);
    return NextResponse.json({ error: "Failed to send invites" }, { status: 500 });
  }
});

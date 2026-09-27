import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { computeEventContentHash } from "@/lib/contentHash";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { CLUB_ROLES, requireClubRole } from "@/server/authz/requireClubRole";
import { hasRole } from "@/lib/roles";
import { getElevatedClient } from "@/server/db/elevated";
import { runAfterResponse } from "@/server/afterResponse";
import { parseBody } from "@/server/body";
import {
  CREATE_EVENT_FIELD_KEYS,
  CreateEventBody,
} from "@/contracts/events";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

export const POST = withRoute({ cache: "private", action: "create event" }, async (request: NextRequest) => {
  try {
    const ctx = await createRequestContext();

    // Keeps this arm's own anonymous bytes (DEC-34).
    if (!ctx.user) {
      return NextResponse.json(
        { error: "You must be signed in to create an event" },
        { status: 401 }
      );
    }

    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    // The contract (plan 06-08, REFAC-15): today's texts in today's order,
    // title/description/location sanitized, the date rules last, field only
    // for start_date and end_date. F-094: a non-JSON, non-object or
    // non-string-text body is a 400 (INTENTIONAL BEHAVIOUR CHANGE).
    const parsed = await parseBody(request, CreateEventBody, {
      fieldFor: CREATE_EVENT_FIELD_KEYS,
    });
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const {
      title,
      description,
      location,
      start_date,
      end_date,
      tags,
      image_url,
      category,
      is_free,
      price,
      rsvp_link,
    } = body;

    // Get user profile with roles
    const { data: profile } = await supabase
      .from("users")
      .select("name, email, roles")
      .eq("id", user.id)
      .single();

    const organizer = profile?.name || profile?.email || user.email || "Unknown";

    // Compute content hash for duplicate detection
    const contentHash = await computeEventContentHash(title, start_date, organizer);

    // Check for duplicate events
    const { data: existing } = await supabase
      .from("events")
      .select("id")
      .eq("content_hash", contentHash)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A similar event already exists with the same title, date, and organizer" },
        { status: 409 }
      );
    }

    // Check for time-overlap: same creator or same club already has an event at this exact start time
    const overlapQuery = supabase
      .from("events")
      .select("id, title")
      .eq("start_date", start_date)
      .neq("status", "rejected")
      .is("deleted_at", null);

    if (body.club_id) {
      // Club event: check if this club already has an event at the same time
      overlapQuery.eq("club_id", body.club_id);
    } else {
      // Personal event: check if this user already has an event at the same time
      overlapQuery.eq("created_by", user.id).is("club_id", null);
    }

    const { data: overlapping } = await overlapQuery.maybeSingle();

    if (overlapping) {
      return NextResponse.json(
        {
          error: body.club_id
            ? "This club already has an event at this time"
            : "You already have an event at this time",
        },
        { status: 409 }
      );
    }

    // Determine event status based on context
    // - Admins: always auto-approved
    // - Club events from approved clubs: auto-approved (club member must be verified)
    // - Non-club events: always pending, requires admin approval
    let status: "pending" | "approved" = "pending";

    if (ctx.profile !== null && hasRole(ctx.profile, "admin")) {
      status = "approved";
    } else if (body.club_id) {
      // Check the club is approved AND user is a member/organizer of it
      const { data: club } = await supabase
        .from("clubs")
        .select("id, status")
        .eq("id", body.club_id)
        .single();

      if (club && club.status === "approved") {
        const membership = await requireClubRole(
          supabase,
          body.club_id,
          user.id,
          CLUB_ROLES
        );

        if (membership.ok) {
          status = "approved";
        }
      }
    }
    // Non-club events (no club_id) stay "pending" regardless of user role

    const { data, error } = await supabase
      .from("events")
      .insert({
        title,
        description,
        start_date,
        end_date: end_date || start_date,
        location,
        organizer,
        tags: tags,
        image_url: image_url || null,
        category: category || tags[0] || null,
        club_id: body.club_id || null,
        status,
        created_by: user.id,
        content_hash: contentHash,
        is_free: is_free ?? true,
        price: is_free === false ? (price || null) : null,
        rsvp_link: rsvp_link || null,
      })
      .select()
      .single();

    if (error) {
      log.error("Error creating event", { error });
      return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
    }

    const message = status === "approved"
      ? "Event created and approved"
      : "Event submitted for review";

    // Notification fanout for approved events with a club
    if (status === "approved" && body.club_id) {
      const fanout = async () => {
        try {
          const { data: clubInfo } = await supabase
            .from("clubs")
            .select("name")
            .eq("id", body.club_id)
            .single();

          const clubName = clubInfo?.name || "A club";

          const { data: followers } = await supabase
            .from("club_followers")
            .select("user_id")
            .eq("club_id", body.club_id);

          if (followers && followers.length > 0) {
            // notifications INSERT is granted to service_role only, so on the
            // cookie client this fanout never delivered (REVIEW-05 WR-10).
            // REGISTRY.md row: "Notify another user (notifications insert)".
            const { error: notifyError } = await getElevatedClient()
              .from("notifications")
              .insert(
                followers.map((f: { user_id: string }) => ({
                  user_id: f.user_id,
                  type: "new_event",
                  title: "New Event",
                  message: `${clubName} published: ${title}`,
                  event_id: data.id,
                  read: false,
                }))
              );
            if (notifyError) {
              log.error("Notification fanout insert failed", { error: notifyError });
            }
          }
        } catch (err) {
          log.error("Notification fanout error", { error: err });
        }
      };
      // Scheduled with after() so the platform keeps the instance alive for
      // it: a detached promise can be dropped once the response is sent on
      // serverless (REVIEW-05 iter3 WR-06).
      runAfterResponse(fanout);
    }

    return NextResponse.json(
      { event: data, message },
      { status: 201 }
    );
  } catch (error) {
    log.error("Error in create event", { error });
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
});

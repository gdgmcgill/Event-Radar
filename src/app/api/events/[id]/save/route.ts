/**
 * POST /api/events/:id/save - Toggle save/unsave for the authenticated user
 * DELETE /api/events/:id/save - Unsave an event
 *
 * Note: users.saved_events_count is updated automatically by a Postgres trigger
 * (saved_events_count_trigger) on the saved_events table. No manual increment/
 * decrement is needed here.
 */

import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { notFound, serverError } from "@/server/errors";
import { ok } from "@/server/http";
import type { NextRequest } from "next/server";
import { withRoute } from "@/server/route";
import { parseWith } from "@/server/body";
import { DetailParams } from "@/contracts/discovery";
import { log } from "@/server/log";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export const DELETE = withRoute({ cache: "private", action: "unsave event" }, async (_request: NextRequest, { params }: RouteContext) => {
  try {
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;

    const { id: eventId } = await params;

    const { error: deleteError } = await ctx.supabase
      .from("saved_events")
      .delete()
      .eq("user_id", user.id)
      .eq("event_id", eventId);

    if (deleteError) {
      log.error("Error deleting saved event", { error: deleteError });
      return serverError("unsave event");
    }

    return ok({ saved: false });
  } catch (error) {
    log.error("Unexpected error unsaving event", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withRoute({ cache: "private", action: "save event" }, async (_request: NextRequest, { params }: RouteContext) => {
  try {
    const ctx = await createRequestContext();
    const active = requireActiveUser(ctx);
    if (!active.ok) return active.response;
    const onboarded = requireOnboarded(ctx);
    if (!onboarded.ok) return onboarded.response;
    const user = active.user;
    const supabase = ctx.supabase;

    const { id: eventId } = await params;

    // Check if event exists
    const { data: eventExists, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .is("deleted_at", null)
      .maybeSingle();

    if (eventError) {
      log.error("Error looking up event", { error: eventError });
      return serverError("verify event");
    }

    if (!eventExists) {
      return notFound("Event not found");
    }

    // Check if already saved
    const { data: existing, error: existingError } = await supabase
      .from("saved_events")
      .select("id")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingError) {
      log.error("Error checking saved event", { error: existingError });
      return serverError("check saved event");
    }

    // Toggle: if already saved, unsave it
    if (existing) {
      const { error: deleteError } = await supabase
        .from("saved_events")
        .delete()
        .eq("user_id", user.id)
        .eq("event_id", eventId);

      if (deleteError) {
        log.error("Error unsaving event", { error: deleteError });
        return serverError("unsave event");
      }

      return ok({ saved: false });
    }

    // Save it
    const { error: insertError } = await supabase
      .from("saved_events")
      .insert({ user_id: user.id, event_id: eventId });

    if (insertError) {
      log.error("Save event error", { error: insertError });
      return serverError("save event");
    }

    return ok({ saved: true });
  } catch (error) {
    log.error("Unexpected error saving event", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

/** Idempotent counterpart for discovery cards; the legacy POST toggle remains. */
export const PUT = withRoute({ cache: "private", action: "save event" }, async (_request: NextRequest, { params }: RouteContext) => {
  const ctx = await createRequestContext();
  const active = requireActiveUser(ctx); if (!active.ok) return active.response;
  const onboarded = requireOnboarded(ctx); if (!onboarded.ok) return onboarded.response;
  const parsed = parseWith(DetailParams, await params); if (!parsed.ok) return parsed.response;
  const { id } = parsed.data;
  const { data: event, error } = await ctx.supabase.from("events").select("id").eq("id", id).eq("status", "approved").is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!event) return notFound("Event not found");
  const { error: saveError } = await ctx.supabase.from("saved_events").upsert({ user_id: active.user.id, event_id: id }, { onConflict: "user_id,event_id", ignoreDuplicates: true });
  if (saveError) throw saveError;
  return ok({ saved: true });
});

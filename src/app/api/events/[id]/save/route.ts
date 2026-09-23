/**
 * POST /api/events/:id/save - Toggle save/unsave for the authenticated user
 * DELETE /api/events/:id/save - Unsave an event
 *
 * Note: users.saved_events_count is updated automatically by a Postgres trigger
 * (saved_events_count_trigger) on the saved_events table. No manual increment/
 * decrement is needed here.
 */

import { NextResponse } from "next/server";
import { checkBanStatus } from "@/lib/ban";
import { createRequestContext } from "@/server/context";
import { requireUser } from "@/server/authz/requireUser";
import { notFound, serverError } from "@/server/errors";
import { ok } from "@/server/http";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id: eventId } = await params;
    const ctx = await createRequestContext();

    const auth = requireUser(ctx);
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const { error: deleteError } = await ctx.supabase
      .from("saved_events")
      .delete()
      .eq("user_id", user.id)
      .eq("event_id", eventId);

    if (deleteError) {
      console.error("Error deleting saved event:", deleteError);
      return serverError("unsave event");
    }

    return ok({ saved: false });
  } catch (error) {
    console.error("Unexpected error unsaving event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const banResponse = await checkBanStatus();
    if (banResponse) return banResponse;

    const { id: eventId } = await params;
    const ctx = await createRequestContext();

    const auth = requireUser(ctx);
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const supabase = ctx.supabase;

    // Check if event exists
    const { data: eventExists, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .is("deleted_at", null)
      .maybeSingle();

    if (eventError) {
      console.error("Error looking up event:", eventError);
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
      console.error("Error checking saved event:", existingError);
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
        console.error("Error unsaving event:", deleteError);
        return serverError("unsave event");
      }

      return ok({ saved: false });
    }

    // Save it
    const { error: insertError } = await supabase
      .from("saved_events")
      .insert({ user_id: user.id, event_id: eventId });

    if (insertError) {
      console.error("Save event error:", insertError);
      return serverError("save event");
    }

    return ok({ saved: true });
  } catch (error) {
    console.error("Unexpected error saving event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

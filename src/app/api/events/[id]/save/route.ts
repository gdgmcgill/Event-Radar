/**
 * POST /api/events/:id/save - Toggle save/unsave for the authenticated user
 * DELETE /api/events/:id/save - Unsave an event
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import { unauthorizedError, notFoundError, internalError } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id: eventId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    const { error: deleteError } = await supabase
      .from("saved_events")
      .delete()
      .eq("user_id", user.id)
      .eq("event_id", eventId);

    if (deleteError) {
      logger.error("Failed to unsave event", deleteError, { eventId, userId: user.id });
      return internalError("Failed to unsave event");
    }

    return NextResponse.json({ saved: false });
  } catch (error) {
    logger.error("Unexpected error unsaving event", error);
    return internalError();
  }
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id: eventId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    const { data: eventExists, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      logger.error("Failed to verify event", eventError, { eventId });
      return internalError("Failed to verify event");
    }

    if (!eventExists) {
      return notFoundError("Event");
    }

    const { data: existing, error: existingError } = await supabase
      .from("saved_events")
      .select("id")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingError) {
      logger.error("Failed to check saved event", existingError, { eventId, userId: user.id });
      return internalError("Failed to check saved event");
    }

    if (existing) {
      const { error: deleteError } = await supabase
        .from("saved_events")
        .delete()
        .eq("user_id", user.id)
        .eq("event_id", eventId);

      if (deleteError) {
        logger.error("Failed to unsave event", deleteError, { eventId, userId: user.id });
        return internalError("Failed to unsave event");
      }

      return NextResponse.json({ saved: false });
    }

    const { error: insertError } = await supabase
      .from("saved_events")
      .insert({ user_id: user.id, event_id: eventId });

    if (insertError) {
      logger.error("Failed to save event", insertError, { eventId, userId: user.id });
      return internalError("Failed to save event");
    }

    return NextResponse.json({ saved: true });
  } catch (error) {
    logger.error("Unexpected error saving event", error);
    return internalError();
  }
}

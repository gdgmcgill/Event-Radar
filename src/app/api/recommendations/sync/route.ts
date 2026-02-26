// TODO(AS-6): Wire up recommendation sync to external AI service or remove this route

/**
 * POST /api/recommendations/sync
 * Sync an event to the recommendation service
 * Called when events are created, updated, or deleted
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resilientFetch } from "@/lib/api/resilient-fetch";
import { validationError, internalError } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";

const RECOMMENDATION_API_URL =
  process.env.RECOMMENDATION_API_URL || "http://localhost:8000";

interface EventSyncPayload {
  action: "create" | "update" | "delete";
  event_id: string;
  title?: string;
  description?: string;
  tags?: string[];
  hosting_club?: string;
  category?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: EventSyncPayload = await request.json();

    if (!body.event_id) {
      return validationError("Missing event_id");
    }

    if (body.action === "delete") {
      const response = await resilientFetch(
        `${RECOMMENDATION_API_URL}/events/remove`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: body.event_id }),
        },
        { retries: 1 }
      );

      if (!response.ok) {
        logger.warn("Failed to remove event from recommendations", {
          eventId: body.event_id,
          status: response.status,
        });
      }

      return NextResponse.json({ success: true, action: "delete" });
    }

    if (!body.title || !body.description) {
      return validationError("Missing title or description for create/update");
    }

    const response = await resilientFetch(
      `${RECOMMENDATION_API_URL}/embed/event`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: {
            event_id: body.event_id,
            title: body.title,
            description: body.description,
            tags: body.tags || [],
            hosting_club: body.hosting_club,
            category: body.category,
          },
          store: true,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Failed to sync event to recommendation service", undefined, {
        eventId: body.event_id,
        status: response.status,
        detail: errorText,
      });
      return internalError("Failed to sync event", errorText);
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      action: body.action,
      event_id: data.event_id,
      stored: data.stored,
    });
  } catch (error) {
    logger.error("Error syncing event", error);
    return internalError("Failed to sync event");
  }
}

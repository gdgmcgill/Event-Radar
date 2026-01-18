/**
 * POST /api/recommendations/sync
 * Sync an event to the recommendation service
 * Called when events are created, updated, or deleted
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

/**
 * Sync event to recommendation service
 */
export async function POST(request: NextRequest) {
  try {
    const body: EventSyncPayload = await request.json();

    if (!body.event_id) {
      return NextResponse.json(
        { error: "Missing event_id" },
        { status: 400 }
      );
    }

    if (body.action === "delete") {
      // Remove event from recommendation index
      const response = await fetch(`${RECOMMENDATION_API_URL}/events/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: body.event_id }),
      });

      if (!response.ok) {
        console.error("Failed to remove event from recommendations");
      }

      return NextResponse.json({ success: true, action: "delete" });
    }

    // Create or update event embedding
    if (!body.title || !body.description) {
      return NextResponse.json(
        { error: "Missing title or description for create/update" },
        { status: 400 }
      );
    }

    const response = await fetch(`${RECOMMENDATION_API_URL}/embed/event`, {
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to sync event:", errorText);
      return NextResponse.json(
        { error: "Failed to sync event", detail: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      action: body.action,
      event_id: data.event_id,
      stored: data.stored,
    });
  } catch (error) {
    console.error("Error syncing event:", error);
    return NextResponse.json(
      { error: "Failed to sync event" },
      { status: 500 }
    );
  }
}



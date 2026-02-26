/**
 * POST /api/webhooks/events
 * Ingest events from external sources via webhook
 * Authenticates via HMAC-SHA256 signature in x-webhook-signature header
 * Accepts single event or array of events (max 50)
 * All ingested events are created with status "pending"
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validationError, internalError, apiError } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { createHmac, timingSafeEqual } from "crypto";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

interface WebhookEventPayload {
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  location: string;
  club_id: string;
  tags?: string[];
  image_url?: string | null;
  source?: "manual" | "instagram" | "admin";
  source_url?: string | null;
}

function verifySignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const sig = signature.replace("sha256=", "");

  try {
    return timingSafeEqual(
      Buffer.from(sig, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

function validatePayload(body: unknown): body is WebhookEventPayload {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.title === "string" &&
    b.title.length > 0 &&
    typeof b.description === "string" &&
    typeof b.event_date === "string" &&
    typeof b.event_time === "string" &&
    typeof b.location === "string" &&
    b.location.length > 0 &&
    typeof b.club_id === "string" &&
    b.club_id.length > 0
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!WEBHOOK_SECRET) {
      logger.error("WEBHOOK_SECRET is not configured");
      return internalError("Webhook not configured");
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-webhook-signature");

    if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
      return apiError("INVALID_SIGNATURE", "Invalid webhook signature", 401);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return validationError("Invalid JSON payload");
    }

    const events: unknown[] = Array.isArray(body) ? body : [body];

    if (events.length === 0) {
      return validationError("Empty event payload");
    }

    if (events.length > 50) {
      return validationError("Maximum 50 events per request");
    }

    const supabase = createServiceClient();
    const results: { index: number; id?: string; error?: string }[] = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      if (!validatePayload(event)) {
        results.push({
          index: i,
          error:
            "Invalid payload: missing required fields (title, description, event_date, event_time, location, club_id)",
        });
        continue;
      }

      const { data, error } = await supabase
        .from("events")
        .insert({
          title: event.title,
          description: event.description,
          event_date: event.event_date,
          event_time: event.event_time,
          location: event.location,
          club_id: event.club_id,
          tags: event.tags ?? [],
          image_url: event.image_url ?? null,
          source: event.source ?? "manual",
          source_url: event.source_url ?? null,
          status: "pending",
        } as never)
        .select("id")
        .single();

      if (error) {
        logger.error("Failed to insert webhook event", error, {
          index: i,
          title: event.title,
        });
        results.push({ index: i, error: error.message });
      } else {
        const inserted = data as { id: string } | null;
        results.push({ index: i, id: inserted?.id });
        logger.info("Webhook event ingested", {
          eventId: inserted?.id,
          title: event.title,
          source: event.source,
        });
      }
    }

    const succeeded = results.filter((r) => r.id).length;
    const failed = results.filter((r) => r.error).length;

    return NextResponse.json(
      {
        received: events.length,
        succeeded,
        failed,
        results,
      },
      { status: failed === events.length ? 422 : 201 }
    );
  } catch (error) {
    logger.error("Unexpected error in webhook handler", error);
    return internalError();
  }
}

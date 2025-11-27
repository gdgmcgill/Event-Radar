/**
 * POST /api/webhooks
 * Webhook endpoint for receiving events from external resources
 * Validates HMAC signature and processes incoming events
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";

/**
 * Webhook event payload structure
 */
interface WebhookEvent {
  title: string;
  description: string;
  "event-type": string; // Will be mapped to tags
  date: string; // ISO date string or date string
  time?: string; // Optional time string (HH:mm format)
  location: string;
  club_id?: string; // Optional club ID
  club_name?: string; // Optional club name (will need to resolve to club_id)
  image_url?: string;
  tags?: string[]; // Additional tags
  capacity?: number;
  price?: number;
  registration_url?: string;
  contact_email?: string;
  contact_phone?: string;
}

interface WebhookPayload {
  event_count: number;
  events: WebhookEvent[];
}

/**
 * Verify HMAC signature from request
 */
function verifyHMAC(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error("HMAC verification error:", error);
    return false;
  }
}

/**
 * Validate webhook event structure
 */
function validateEvent(event: WebhookEvent): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!event.title || typeof event.title !== "string" || event.title.trim().length === 0) {
    errors.push("title is required and must be a non-empty string");
  }

  if (!event.description || typeof event.description !== "string" || event.description.trim().length === 0) {
    errors.push("description is required and must be a non-empty string");
  }

  if (!event["event-type"] || typeof event["event-type"] !== "string") {
    errors.push("event-type is required and must be a string");
  }

  if (!event.date || typeof event.date !== "string") {
    errors.push("date is required and must be a string");
  } else {
    // Validate date format
    const dateObj = new Date(event.date);
    if (isNaN(dateObj.getTime())) {
      errors.push("date must be a valid date string");
    }
  }

  if (!event.location || typeof event.location !== "string" || event.location.trim().length === 0) {
    errors.push("location is required and must be a non-empty string");
  }

  if (event.time && typeof event.time !== "string") {
    errors.push("time must be a string if provided");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Map webhook event to database event format
 */
async function mapEventToDatabase(
  event: WebhookEvent,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ event: any; errors: string[] }> {
  const errors: string[] = [];
  const tags: string[] = [];

  // Add event-type as a tag
  if (event["event-type"]) {
    tags.push(event["event-type"].toLowerCase());
  }

  // Add additional tags if provided
  if (event.tags && Array.isArray(event.tags)) {
    tags.push(...event.tags.map((tag) => tag.toLowerCase()));
  }

  // Parse date and time
  const eventDate = new Date(event.date);
  const eventTime = event.time || "00:00"; // Default to midnight if no time provided

  // Validate time format (HH:mm)
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(eventTime)) {
    errors.push(`Invalid time format: ${eventTime}. Expected HH:mm format`);
  }

  // Resolve club_id if club_name is provided
  let clubId = event.club_id;
  if (!clubId && event.club_name) {
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("id")
      .eq("name", event.club_name)
      .single();

    if (clubError || !club) {
      errors.push(`Club not found: ${event.club_name}`);
    } else {
      clubId = club.id;
    }
  }

  if (!clubId) {
    errors.push("club_id or club_name is required");
  }

  const dbEvent = {
    title: event.title.trim(),
    description: event.description.trim(),
    event_date: eventDate.toISOString().split("T")[0], // YYYY-MM-DD format
    event_time: eventTime,
    location: event.location.trim(),
    club_id: clubId,
    tags: [...new Set(tags)], // Remove duplicates
    image_url: event.image_url || null,
    status: "approved" as const, // Webhook events are auto-approved
    // Additional metadata can be stored in a JSONB column if needed
  };

  return { event: dbEvent, errors };
}

export async function POST(request: NextRequest) {
  try {
    // Get HMAC secret from environment
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("WEBHOOK_SECRET environment variable is not set");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    // Get signature from headers (common header names: x-signature, x-hub-signature-256, x-webhook-signature)
    const signature =
      request.headers.get("x-signature") ||
      request.headers.get("x-hub-signature-256")?.replace("sha256=", "") ||
      request.headers.get("x-webhook-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature header" },
        { status: 401 }
      );
    }

    // Get raw body for HMAC verification
    const rawBody = await request.text();

    // Verify HMAC signature
    if (!verifyHMAC(rawBody, signature, webhookSecret)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse JSON payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Validate payload structure
    if (
      typeof payload.event_count !== "number" ||
      !Array.isArray(payload.events)
    ) {
      return NextResponse.json(
        { error: "Invalid payload structure. Expected event_count (number) and events (array)" },
        { status: 400 }
      );
    }

    // Validate event_count matches events array length
    if (payload.event_count !== payload.events.length) {
      return NextResponse.json(
        {
          error: `event_count (${payload.event_count}) does not match events array length (${payload.events.length})`,
        },
        { status: 400 }
      );
    }

    // Validate all events
    const validationResults = payload.events.map((event, index) => ({
      index,
      ...validateEvent(event),
    }));

    const invalidEvents = validationResults.filter((result) => !result.valid);
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        {
          error: "Invalid events found",
          details: invalidEvents.map((result) => ({
            index: result.index,
            errors: result.errors,
          })),
        },
        { status: 400 }
      );
    }

    // Process events
    const supabase = await createClient();
    const processedEvents: any[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < payload.events.length; i++) {
      const event = payload.events[i];
      const { event: dbEvent, errors: mappingErrors } =
        await mapEventToDatabase(event, supabase);

      if (mappingErrors.length > 0) {
        errors.push({
          index: i,
          error: mappingErrors.join("; "),
        });
        continue;
      }

      // Insert event into database
      const { data, error: insertError } = await supabase
        .from("events")
        .insert(dbEvent)
        .select()
        .single();

      if (insertError) {
        errors.push({
          index: i,
          error: insertError.message,
        });
      } else {
        processedEvents.push(data);
      }
    }

    // Return response
    if (errors.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: `Successfully processed ${processedEvents.length} event(s)`,
          events: processedEvents,
        },
        { status: 200 }
      );
    } else if (processedEvents.length > 0) {
      // Partial success
      return NextResponse.json(
        {
          success: true,
          message: `Processed ${processedEvents.length} event(s) with ${errors.length} error(s)`,
          events: processedEvents,
          errors,
        },
        { status: 207 } // Multi-Status
      );
    } else {
      // All failed
      return NextResponse.json(
        {
          success: false,
          message: "Failed to process all events",
          errors,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


/**
 * POST /functions/v1/events-webhook
 * Webhook endpoint for receiving events from external resources
 * Validates HMAC signature and processes incoming events
 */

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

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
 * Verify HMAC signature using Web Crypto API (Deno)
 */
async function verifyHMAC(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);

    // Import the secret key for HMAC
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Compute HMAC
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, payloadData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    return result === 0;
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
 * Database event structure for insertion
 */
interface DatabaseEvent {
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  location: string;
  club_id: string;
  tags: string[];
  image_url: string | null;
  status: "approved";
}

/**
 * Map webhook event to database event format
 * @param supabase - Supabase client instance (using any to avoid complex type inference issues)
 */
async function mapEventToDatabase(
  event: WebhookEvent,
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<{ event: DatabaseEvent; errors: string[] }> {
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
  let clubId: string | undefined = event.club_id;
  if (!clubId && event.club_name) {
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("id")
      .eq("name", event.club_name)
      .single();

    if (clubError || !club) {
      errors.push(`Club not found: ${event.club_name}`);
    } else {
      // Type assertion needed due to generic type inference limitations
      clubId = (club as { id: string }).id;
    }
  }

  if (!clubId) {
    errors.push("club_id or club_name is required");
    // Return early with errors if no club_id
    return { event: {} as DatabaseEvent, errors };
  }

  const dbEvent: DatabaseEvent = {
    title: event.title.trim(),
    description: event.description.trim(),
    event_date: eventDate.toISOString().split("T")[0], // YYYY-MM-DD format
    event_time: eventTime,
    location: event.location.trim(),
    club_id: clubId,
    tags: [...new Set(tags)], // Remove duplicates
    image_url: event.image_url || null,
    status: "approved", // Webhook events are auto-approved
    // Additional metadata can be stored in a JSONB column if needed
  };

  return { event: dbEvent, errors };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-signature, x-hub-signature-256, x-webhook-signature",
      },
    });
  }

  try {
    // Get HMAC secret from environment
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("WEBHOOK_SECRET environment variable is not set");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get Supabase URL and service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SUPABASE_SERVICE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Supabase configuration missing");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get signature from headers (common header names: x-signature, x-hub-signature-256, x-webhook-signature)
    const signature =
      req.headers.get("x-signature") ||
      req.headers.get("x-hub-signature-256")?.replace("sha256=", "") ||
      req.headers.get("x-webhook-signature");

    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing signature header" }),
        { 
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get raw body for HMAC verification
    const rawBody = await req.text();

    // Verify HMAC signature
    const isValid = await verifyHMAC(rawBody, signature, webhookSecret);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { 
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Parse JSON payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (_error) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate payload structure
    if (
      typeof payload.event_count !== "number" ||
      !Array.isArray(payload.events)
    ) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid payload structure. Expected event_count (number) and events (array)" 
        }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate event_count matches events array length
    if (payload.event_count !== payload.events.length) {
      return new Response(
        JSON.stringify({
          error: `event_count (${payload.event_count}) does not match events array length (${payload.events.length})`,
        }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate all events
    const validationResults = payload.events.map((event, index) => ({
      index,
      ...validateEvent(event),
    }));

    const invalidEvents = validationResults.filter((result) => !result.valid);
    if (invalidEvents.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Invalid events found",
          details: invalidEvents.map((result) => ({
            index: result.index,
            errors: result.errors,
          })),
        }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with service role key (bypasses RLS)
    // Using service role key bypasses RLS policies
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Process events
    const processedEvents: DatabaseEvent[] = [];
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
      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully processed ${processedEvents.length} event(s)`,
          events: processedEvents,
        }),
        { 
          status: 200,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } else if (processedEvents.length > 0) {
      // Partial success
      return new Response(
        JSON.stringify({
          success: true,
          message: `Processed ${processedEvents.length} event(s) with ${errors.length} error(s)`,
          events: processedEvents,
          errors,
        }),
        { 
          status: 207, // Multi-Status
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } else {
      // All failed
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to process all events",
          errors,
        }),
        { 
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Set environment variables:
     export WEBHOOK_SECRET=your-secret-key
  3. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/events-webhook' \
    --header 'Content-Type: application/json' \
    --header 'x-signature: <computed-hmac-signature>' \
    --data '{
      "event_count": 1,
      "events": [{
        "title": "Test Event",
        "description": "Test Description",
        "event-type": "workshop",
        "date": "2024-12-31",
        "time": "14:00",
        "location": "Test Location",
        "club_id": "your-club-id"
      }]
    }'

*/

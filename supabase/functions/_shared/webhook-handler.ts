/**
 * handleWebhook — the events-webhook request logic, without Deno globals
 * (plan 06-03, F-039, DEC-64).
 *
 * supabase/functions/events-webhook/index.ts is now a thin Deno adapter: it
 * reads the environment, builds the service-role client and hands every
 * request here with the insert injected. Jest drives this module directly
 * (src/__tests__/webhook/webhook-handler.test.ts), which is the proof: Deno is
 * not installed locally.
 *
 * The flow is the one the function had before this module existed, check for
 * check and byte for byte (slice-6-characterization.txt § 3), with two
 * INTENTIONAL BEHAVIOUR CHANGES:
 *
 *   1. A wrong-length signature answers 401 Invalid signature. It used to reach
 *      crypto.timingSafeEqual, throw a RangeError and answer 500 from the outer
 *      catch (a length oracle). verifySignature length-checks first.
 *   2. A replayed payload inserts nothing new. Each row now carries
 *      content_hash, so the unique partial index idx_events_content_hash
 *      refuses a second copy with 23505, reported per event as "duplicate".
 *
 * M0 / DI-83: a JSON null body, a null element in `events`, and a non-string
 * array tag now answer validation 400s before any insert (rows 7, 11 and 12).
 * IN-05: database failures use a stable public code and structured diagnostics;
 * unexpected failures log their class without logging payloads or credentials.
 *
 * Imports are relative `.ts` paths so the Deno runtime resolves them; the root
 * tsconfig sets allowImportingTsExtensions so tsc accepts them too.
 */
import { computeEventContentHash } from "./contentHash.ts";
import { webhookEventErrors, webhookPayloadError } from "./webhook-contract.ts";
import { verifySignature } from "./webhook-signature.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A webhook event as the sender supplies it. The shared contract validates the
 * required fields, category, time and array tag elements before mapping.
 */
interface RawWebhookEvent {
  title: string;
  description: string;
  category?: string;
  date: string;
  time?: string;
  duration?: number;
  location: string;
  organizer?: string;
  image_url?: string;
  source_url?: string;
  tags?: string[];
}

/**
 * The row written to public.events: title, description, start_date,
 * end_date, location, category, tags, image_url, organizer, status (always
 * "pending"), source, source_url and, since plan 06-03, content_hash. No
 * club_id: a webhook event is not attached to a club.
 */
export interface DatabaseEvent {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  category: string | null;
  tags: string[];
  image_url: string | null;
  organizer: string | null;
  status: "pending" | "approved" | "rejected";
  source: string;
  source_url: string | null;
  content_hash: string;
}

/** What the injected insert answers: the stored row, or the database error. */
export interface InsertResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

export interface WebhookDeps {
  /** WEBHOOK_SECRET; unset or empty is a configuration error. */
  secret: string | undefined;
  /** Whether the database URL and service-role key are present. */
  configured: boolean;
  /** Insert one row into public.events and return it (insert().select().single()). */
  insertEvent: (row: DatabaseEvent) => Promise<InsertResult>;
}

/** Postgres unique_violation: idx_events_content_hash refused a second copy. */
export const UNIQUE_VIOLATION = "23505";

/** The per-event error a replayed event is reported with. */
export const DUPLICATE_ERROR = "duplicate";

/** IN-05: stable sender-facing error; never expose database error messages. */
export const INSERT_FAILED_ERROR = "insert_failed";

// ─── Responses ────────────────────────────────────────────────────────────────

const JSON_HEADERS = { "Content-Type": "application/json" };
const JSON_CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

/**
 * Map a validated webhook event to its database row. The body is the old
 * mapEventToDatabase unchanged; array tags are now validated first (DI-83).
 * content_hash is computed only for a
 * row that mapped without errors, with the same arguments the admin create
 * route uses.
 */
async function mapEventToDatabase(
  event: RawWebhookEvent
): Promise<{ event: DatabaseEvent; errors: string[] }> {
  const errors: string[] = [];
  const tags: string[] = [];

  const category = event.category || null;

  if (event.category) {
    tags.push(event.category.toLowerCase());
  }

  if (event.tags && Array.isArray(event.tags)) {
    tags.push(...event.tags.map((tag) => tag.toLowerCase()));
  }

  const eventDate = new Date(event.date);
  if (isNaN(eventDate.getTime())) {
    errors.push("Invalid date format");
    return { event: {} as DatabaseEvent, errors };
  }

  const eventTime = event.time || "00:00";

  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(eventTime)) {
    errors.push(`Invalid time format: ${eventTime}. Expected HH:mm format`);
  }

  const [hours, minutes] = eventTime.split(":").map(Number);
  const startDate = new Date(eventDate);
  startDate.setHours(hours, minutes, 0, 0);

  const durationMinutes = event.duration || 60;
  const endDate = new Date(startDate);
  endDate.setMinutes(endDate.getMinutes() + durationMinutes);

  const dbEvent: Omit<DatabaseEvent, "content_hash"> = {
    title: event.title.trim(),
    description: event.description.trim(),
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    location: event.location.trim(),
    category: category,
    tags: [...new Set(tags)],
    image_url: event.image_url || null,
    organizer: event.organizer?.trim() || null,
    status: "pending",
    source: event.source_url ? "instagram" : "manual",
    source_url: event.source_url || null,
  };

  if (errors.length > 0) {
    return { event: dbEvent as DatabaseEvent, errors };
  }

  const content_hash = await computeEventContentHash(
    dbEvent.title,
    dbEvent.start_date,
    dbEvent.organizer || ""
  );
  return { event: { ...dbEvent, content_hash }, errors };
}

// ─── The handler ──────────────────────────────────────────────────────────────

export async function handleWebhook(req: Request, deps: WebhookDeps): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, x-signature, x-hub-signature-256, x-webhook-signature",
      },
    });
  }

  try {
    const secret = deps.secret;
    if (!deps.configured || !secret) {
      return json({ error: "Server configuration error" }, 500, JSON_HEADERS);
    }

    // The three accepted headers, in today's precedence. Only
    // x-hub-signature-256 has its "sha256=" prefix removed here.
    const signature =
      req.headers.get("x-signature") ||
      req.headers.get("x-hub-signature-256")?.replace("sha256=", "") ||
      req.headers.get("x-webhook-signature");

    if (!signature) {
      return json({ error: "Missing signature header" }, 401, JSON_HEADERS);
    }

    const rawBody = await req.text();

    // A selected signature still starting with "sha256=" (x-signature or
    // x-webhook-signature carrying the prefix) was never accepted: it is the
    // wrong length for a hex digest. verifySignature would strip the prefix,
    // so it is refused here to keep exactly the set of accepted inputs, now
    // with a 401 instead of the old 500.
    const valid =
      !signature.startsWith("sha256=") && verifySignature(rawBody, signature, secret);
    if (!valid) {
      return json({ error: "Invalid signature" }, 401, JSON_HEADERS);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid JSON payload" }, 400, JSON_HEADERS);
    }

    // DI-83: null envelopes follow the shared structure validation.
    const payloadError = webhookPayloadError(payload);
    if (payloadError) {
      return json({ error: payloadError }, 400, JSON_HEADERS);
    }

    const events = (payload as { events: unknown[] }).events;

    const validationResults = events.map((event, index) => {
      const errors = webhookEventErrors(event);
      return { index, valid: errors.length === 0, errors };
    });

    const invalidEvents = validationResults.filter((result) => !result.valid);
    if (invalidEvents.length > 0) {
      return json(
        {
          error: "Invalid events found",
          details: invalidEvents.map((result) => ({
            index: result.index,
            errors: result.errors,
          })),
        },
        400,
        JSON_HEADERS
      );
    }

    const processedEvents: unknown[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < events.length; i++) {
      const { event: dbEvent, errors: mappingErrors } = await mapEventToDatabase(
        events[i] as RawWebhookEvent
      );

      if (mappingErrors.length > 0) {
        errors.push({ index: i, error: mappingErrors.join("; ") });
        continue;
      }

      const { data, error: insertError } = await deps.insertEvent(dbEvent);

      if (insertError) {
        if (insertError.code !== UNIQUE_VIOLATION) {
          // IN-05: Postgres messages can include submitted values. Record the
          // operation and SQLSTATE, never the message, row, signature or secret.
          console.error(JSON.stringify({
            event: "webhook.insert_failed",
            index: i,
            code: /^[A-Z0-9]{5}$/.test(insertError.code ?? "") ? insertError.code : "unknown",
          }));
        }
        errors.push({
          index: i,
          error: insertError.code === UNIQUE_VIOLATION ? DUPLICATE_ERROR : INSERT_FAILED_ERROR,
        });
      } else {
        processedEvents.push(data);
      }
    }

    if (errors.length === 0) {
      return json(
        {
          success: true,
          message: `Successfully processed ${processedEvents.length} event(s)`,
          events: processedEvents,
        },
        200,
        JSON_CORS_HEADERS
      );
    } else if (processedEvents.length > 0) {
      return json(
        {
          success: true,
          message: `Processed ${processedEvents.length} event(s) with ${errors.length} error(s)`,
          events: processedEvents,
          errors,
        },
        207,
        JSON_CORS_HEADERS
      );
    } else {
      return json(
        {
          success: false,
          message: "Failed to process all events",
          errors,
        },
        400,
        JSON_CORS_HEADERS
      );
    }
  } catch (error) {
    // IN-05: allowlisted classes cannot echo a sender-controlled error message.
    const errorClass = error instanceof TypeError ? "TypeError"
      : error instanceof RangeError ? "RangeError"
      : error instanceof Error ? "Error" : "Unknown";
    console.error(JSON.stringify({ event: "webhook.unhandled_error", errorClass }));
    return json({ error: "Internal server error" }, 500, JSON_CORS_HEADERS);
  }
}

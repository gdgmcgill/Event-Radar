/**
 * The events-webhook payload contract (plan 06-03, DEC-64).
 *
 * One zod schema shared by the Deno edge function (deno.json maps "zod" to
 * npm:zod@4.6.5) and by Jest and the app (node_modules/zod 4.6.5). It imports
 * only zod: no Deno global, no Node built-in. src/contracts/webhook.ts
 * re-exports it for the app.
 *
 * EVERY MESSAGE IS TODAY'S. The strings and the order they are reported in are
 * the ones validateEvent and the payload checks in
 * supabase/functions/events-webhook/index.ts produced before this module
 * existed (slice-6-characterization.txt § 3 rows 8-10), so a sender sees the
 * same 400 bodies. The semantics are validateEvent's too, including its
 * truthiness: a falsy category or time (null, "", 0, false) passes, an empty
 * date string is "required" rather than "invalid", and a whitespace-only
 * title, description or location fails.
 *
 * M0 / DI-83 additionally validates array tag elements before mapping so a
 * malformed tag yields a 400 before any insert. Non-array tags remain ignored
 * by the mapper for compatibility. duration, organizer, image_url and source_url
 * retain their existing behavior; this contract does not broaden their rules.
 */
import { z } from "zod";

// ─── Today's messages ─────────────────────────────────────────────────────────

export const WEBHOOK_MESSAGES = {
  title: "title is required and must be a non-empty string",
  description: "description is required and must be a non-empty string",
  category: "category must be a string if provided",
  dateRequired: "date is required and must be a string",
  dateInvalid: "date must be a valid date string",
  location: "location is required and must be a non-empty string",
  time: "time must be a string if provided",
  tags: "tags must contain only strings",
  structure:
    "Invalid payload structure. Expected event_count (number) and events (array)",
  // M3 P1-07: the producer run envelope and the empty-batch rule.
  run: "run must be { id: uuid, producer, status: ok|failed, error_code?, items_seen? }",
  emptyWithoutRun: "events must not be empty unless run is present",
} as const;

const M = WEBHOOK_MESSAGES;

// ─── Field rules ──────────────────────────────────────────────────────────────

/** A string with at least one non-whitespace character; one message for every failure. */
function nonEmptyString(message: string) {
  return z
    .string({ error: message })
    .refine((value) => value.trim().length > 0, { error: message });
}

/**
 * validateEvent's optional-string rule: `if (value && typeof value !== "string")`.
 * Any falsy value passes, so this is a predicate, not z.string().optional().
 */
function optionalTruthyString(message: string) {
  return z
    .custom<string | null | undefined>(
      (value) => !value || typeof value === "string",
      { error: message }
    )
    .optional();
}

const dateField = z
  .string({ error: M.dateRequired })
  // An empty string is "required" (validateEvent's `!event.date`), and only
  // that message: abort stops the validity check from adding a second one.
  .refine((value) => value.length > 0, { error: M.dateRequired, abort: true })
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    error: M.dateInvalid,
  });

// ─── Schemas ──────────────────────────────────────────────────────────────────

/**
 * One webhook event. Keys are declared in validateEvent's check order; zod
 * reports issues in declaration order, so the messages come out in that order
 * whatever order the sender's keys are in. Unknown keys are stripped from the
 * parse OUTPUT only; the handler maps the event as received.
 */
export const WebhookEvent = z.object({
  title: nonEmptyString(M.title),
  description: nonEmptyString(M.description),
  category: optionalTruthyString(M.category),
  date: dateField,
  location: nonEmptyString(M.location),
  time: optionalTruthyString(M.time),
  // DI-83: mapping calls toLowerCase on every array element. Keep previously
  // ignored non-array values compatible, but reject unsafe arrays atomically.
  tags: z.custom<unknown>(
    (value) => !Array.isArray(value) || value.every((tag) => typeof tag === "string"),
    { error: M.tags }
  ).optional(),
});

/** A producer id: lower-case letters, digits and @ . _ - (1-80). */
export const PRODUCER_PATTERN = /^[a-z0-9@._-]{1,80}$/;

/** A short machine error code a producer reports: snake_case, 1-64. */
export const ERROR_CODE_PATTERN = /^[a-z0-9_]{1,64}$/;

/**
 * M3 P1-07: the optional producer run block. It names who sent the batch and
 * whether the producer's own collection succeeded, so a failed scrape or an
 * empty but healthy run still reaches the delivery log. Every field failure
 * reports the one run message.
 */
export const WebhookRun = z.object(
  {
    id: z.uuid({ error: M.run }),
    producer: z.string({ error: M.run }).regex(PRODUCER_PATTERN, { error: M.run }),
    status: z.enum(["ok", "failed"], { error: M.run }),
    error_code: z.string({ error: M.run }).regex(ERROR_CODE_PATTERN, { error: M.run }).optional(),
    items_seen: z.number({ error: M.run }).int({ error: M.run }).min(0, { error: M.run }).optional(),
  },
  { error: M.run }
);

/**
 * The envelope. A wrong type for either field, or a payload that is not an
 * object, yields today's single structure message; a count that disagrees
 * with the array yields today's mismatch message. The refine runs only when
 * both fields have the right type (zod skips it otherwise), which is the
 * order the handler checked them in.
 */
export const WebhookPayload = z
  .object(
    {
      event_count: z.number({ error: M.structure }),
      events: z.array(z.unknown(), { error: M.structure }),
      run: WebhookRun.optional(),
    },
    { error: M.structure }
  )
  .refine((payload) => payload.event_count === payload.events.length, {
    error: (issue) => {
      const payload = issue.input as { event_count: number; events: unknown[] };
      return `event_count (${payload.event_count}) does not match events array length (${payload.events.length})`;
    },
  })
  // M3 P1-07: an empty batch is only meaningful as a run report (a heartbeat
  // or a failed collection); without `run` it carries nothing.
  .refine((payload) => payload.events.length > 0 || payload.run !== undefined, {
    error: M.emptyWithoutRun,
  });

export type WebhookEventInput = z.input<typeof WebhookEvent>;
export type WebhookEventOutput = z.infer<typeof WebhookEvent>;
export type WebhookPayloadInput = z.input<typeof WebhookPayload>;
export type WebhookPayloadOutput = z.infer<typeof WebhookPayload>;
export type WebhookRunInput = z.input<typeof WebhookRun>;
export type WebhookRunOutput = z.infer<typeof WebhookRun>;

// ─── Helpers the handler uses ─────────────────────────────────────────────────

/**
 * Every validation message for one event, in validateEvent's order; empty when
 * the event is valid. This is the per-event `errors` array of today's
 * "Invalid events found" 400.
 *
 * A non-null primitive or an array reads as an event with no fields, because
 * validateEvent's property reads (`event.title`, …) on such a value all give
 * undefined. DI-83 uses the same required-field errors for null and undefined,
 * rather than letting them throw from the handler.
 */
export function webhookEventErrors(input: unknown): string[] {
  const view =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? input
      : {};
  const result = WebhookEvent.safeParse(view);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

/**
 * The first envelope message, or null when the envelope is well-formed. The
 * handler answered one message per 400, so only the first issue is reported.
 */
export function webhookPayloadError(input: unknown): string | null {
  const result = WebhookPayload.safeParse(input);
  return result.success ? null : (result.error.issues[0]?.message ?? M.structure);
}

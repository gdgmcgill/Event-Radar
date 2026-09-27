/**
 * Contracts for the events family and the calendar (plan 06-08, REFAC-15,
 * DEC-65).
 *
 * EVERY MESSAGE IS TODAY'S, IN TODAY'S ORDER. The texts and the order the
 * handlers checked them in are pinned by the 06-07 table
 * (src/__tests__/contracts/badRequestTable.ts, bad-request-characterization)
 * and the events PRESERVE suites, which pass unedited against these schemas.
 * Keys are declared in check order because zod reports issues in declaration
 * order and parseWith answers the first. An object-level refinement runs only
 * when every key passed, which is exactly where the handlers checked dates.
 *
 * `field` IS EMITTED WHERE IT WAS (C10 and the 06-07 correction): the create
 * and edit routes name start_date and end_date (the "Start date is required"
 * rule and every validateEventDates result, including the edit route's
 * end_date-only branch). Nothing else carries field.
 *
 * VALUES THE HANDLERS DID NOT CHECK ARE PASSED AS SENT. A key a handler read
 * without a rule (image_url, category, is_free, club_id, a review comment …)
 * is declared `z.any().optional()`: it keeps the type `request.json()` gave it
 * and gains no 400 (C11). Business rules evaluated after a database read or a
 * guard stay in the handlers (the RSVP user_id mismatch 403, the reviews
 * "after the event has ended" rule, the invite friend filter).
 *
 * F-094 (INTENTIONAL BEHAVIOUR CHANGE). A body that is not JSON answers 400
 * `Invalid JSON body` and a non-object body 400 `Request body must be a JSON
 * object` (parseBody). A non-string where the handler sanitized, trimmed or
 * wrote text answers a 400: the create route's required text (a number was
 * coerced to "5" by sanitizeText and an object threw inside it), the edit
 * route's `<Field> must be a string` (a number was written as-is; no text
 * existed to keep), the appeal's required text (a number threw on `.trim()`)
 * and the report's `Message must be a string` (an object threw inside
 * sanitizeText). The report category is looked up as an own key, so an
 * inherited name such as "toString" is refused like any unknown category.
 *
 * QUERY VALUES KEEP TODAY'S SILENT COERCION (Task 2). A value the handler
 * parsed with a default (`parseInt(value || "50", 10)`, `value || "popularity"`)
 * gets the same number or default here, NaN included, and never a new 400.
 * A text parameter the handler read with `searchParams.get` is the string as
 * sent (the first of a repeated key) or null when absent, so every `if (x)`
 * and `x ?? undefined` in the handlers reads exactly as before. Only the
 * 400s the handlers answered are 400s here, in their order.
 */
import { z } from "zod";
import {
  NonEmptyTrimmedString,
  type BodilessRequestInit,
} from "@/contracts/common";
import { isValidISODate, validateEventDates } from "@/lib/dateValidation";
import { sanitizeText } from "@/lib/sanitize";
import { REJECTION_CATEGORIES, type RejectionCategory } from "@/types";
import type { FormOptions } from "@/server/body";
import { decodeEventCursor, type EventCursor } from "@/lib/eventCursor";

// ─── Shared ──────────────────────────────────────────────────────────────────

const END_FORMAT =
  'end_date must be a valid ISO 8601 date (e.g. "2026-03-15" or "2026-03-15T11:00:00Z")';

/** A key the handler read as sent, with no rule: typed as request.json() typed it. */
const asSent = () => z.any().optional();

/** The keys whose 400 carries `field` on the create and edit routes (C10). */
const DATE_FIELD_KEYS = ["start_date", "end_date"] as const;

/**
 * A text field the create route sanitized and required: a string whose
 * sanitized form is not empty, output sanitized (what the handler stored).
 */
function sanitizedRequired(message: string) {
  return z
    .custom<string>(
      (value) => typeof value === "string" && sanitizeText(value) !== "",
      { error: message }
    )
    .transform((value) => sanitizeText(value));
}

// ─── POST /api/events/create ─────────────────────────────────────────────────

export const CREATE_EVENT_MESSAGES = {
  title: "Title is required",
  description: "Description is required",
  startDate: "Start date is required",
  location: "Location is required",
  tags: "At least one tag is required",
  price: "Price must be 20 characters or less",
  linkTooLong: "Registration link is too long",
  linkScheme: "Registration link must use http or https",
  linkInvalid: "Registration link must be a valid URL",
} as const;

export const CREATE_EVENT_FIELD_KEYS = DATE_FIELD_KEYS;

const C = CREATE_EVENT_MESSAGES;

export const CreateEventBody = z
  .object({
    title: sanitizedRequired(C.title),
    description: sanitizedRequired(C.description),
    // Presence only here; the format and future checks are the date
    // refinement below, after price and the link, as the handler ordered them.
    // On success it is a valid ISO string (isValidISODate requires a string).
    start_date: z.custom<string>((value) => Boolean(value), {
      error: C.startDate,
    }),
    location: sanitizedRequired(C.location),
    // The elements are not checked, as the handler did not check them.
    tags: z.custom<string[]>(
      (value) => Array.isArray(value) && value.length > 0,
      { error: C.tags }
    ),
    price: z
      .any()
      .refine(
        (value) => !(value && typeof value === "string" && value.length > 20),
        { error: C.price }
      )
      .optional(),
    rsvp_link: z
      .any()
      .superRefine((value, ctx) => {
        if (!value || typeof value !== "string") return;
        if (value.length > 500) {
          ctx.addIssue({ code: "custom", message: C.linkTooLong });
          return;
        }
        let url: URL;
        try {
          url = new URL(value);
        } catch {
          ctx.addIssue({ code: "custom", message: C.linkInvalid });
          return;
        }
        if (!["http:", "https:"].includes(url.protocol)) {
          ctx.addIssue({ code: "custom", message: C.linkScheme });
        }
      })
      .optional(),
    end_date: asSent(),
    image_url: asSent(),
    category: asSent(),
    is_free: asSent(),
    club_id: asSent(),
  })
  .superRefine((body, ctx) => {
    const dateError = validateEventDates(body.start_date, body.end_date);
    if (dateError) {
      ctx.addIssue({
        code: "custom",
        message: dateError.message,
        path: [dateError.field],
      });
    }
  });

export type CreateEventBodyInput = z.input<typeof CreateEventBody>;
export type CreateEventBodyOutput = z.infer<typeof CreateEventBody>;

// ─── PATCH /api/events/[id] ──────────────────────────────────────────────────

/** The PATCH whitelist, in the handler's order. */
export const EDITABLE_EVENT_FIELDS = [
  "title",
  "description",
  "start_date",
  "end_date",
  "location",
  "tags",
  "image_url",
  "category",
  "is_free",
  "price",
  "rsvp_link",
] as const;

export const EVENT_UPDATE_MESSAGES = {
  noFields: "No valid fields to update",
  title: "Title must be a string",
  description: "Description must be a string",
  location: "Location must be a string",
} as const;

export const EVENT_UPDATE_FIELD_KEYS = DATE_FIELD_KEYS;

const U = EVENT_UPDATE_MESSAGES;

/** A nullable text column the edit route writes as sent: a string or null. */
function textOrNull(message: string) {
  return z
    .custom<string | null>(
      (value) => value === null || typeof value === "string",
      { error: message }
    )
    .optional();
}

/**
 * Only the whitelisted keys survive (the handler copied only those), each as
 * sent and only when present, so `field in body` reads as it did. A body with
 * no whitelisted key answers "No valid fields to update" before any date rule.
 * The date rules are the handler's: with start_date, validateEventDates over
 * start_date and end_date; with end_date alone, the ISO format only.
 */
export const EventUpdateBody = z
  .object({
    title: z
      .custom<string>((value) => typeof value === "string", { error: U.title })
      .optional(),
    description: textOrNull(U.description),
    start_date: asSent(),
    end_date: asSent(),
    location: textOrNull(U.location),
    tags: asSent(),
    image_url: asSent(),
    category: asSent(),
    is_free: asSent(),
    price: asSent(),
    rsvp_link: asSent(),
  })
  .superRefine((body, ctx) => {
    if (!EDITABLE_EVENT_FIELDS.some((key) => key in body)) {
      ctx.addIssue({ code: "custom", message: U.noFields });
      return;
    }
    if ("start_date" in body) {
      const dateError = validateEventDates(
        body.start_date,
        "end_date" in body ? body.end_date : undefined
      );
      if (dateError) {
        ctx.addIssue({
          code: "custom",
          message: dateError.message,
          path: [dateError.field],
        });
      }
    } else if ("end_date" in body && !isValidISODate(body.end_date)) {
      ctx.addIssue({ code: "custom", message: END_FORMAT, path: ["end_date"] });
    }
  });

export type EventUpdateBodyInput = z.input<typeof EventUpdateBody>;
export type EventUpdateBodyOutput = z.infer<typeof EventUpdateBody>;

// ─── POST and DELETE /api/events/[id]/rsvp ───────────────────────────────────

export const RSVP_STATUSES = ["going", "interested"] as const;
export type RsvpStatusValue = (typeof RSVP_STATUSES)[number];

export const RSVP_MESSAGES = {
  userId: "user_id is required",
  status: "status is required",
  badStatus: `Invalid status. Must be one of: ${RSVP_STATUSES.join(", ")}`,
} as const;

const R = RSVP_MESSAGES;

/**
 * Presence as the handler tested it (truthy). A truthy value that is not the
 * caller's id reaches the handler's 403, as before, whatever its type.
 */
const presentUserId = z.custom<unknown>((value) => Boolean(value), {
  error: R.userId,
});

/**
 * POST: user_id first. The status rules run in the handler AFTER its user_id
 * mismatch 403 (RsvpStatus below), so a mismatched caller with a bad status
 * still gets the 403, in today's order.
 */
export const RsvpBody = z.object({
  user_id: presentUserId,
  status: z.unknown().optional(),
});

/** The POST status rules, parsed after the handler's 403. */
export const RsvpStatus = z
  .custom<unknown>((value) => Boolean(value), { error: R.status })
  .pipe(
    z.custom<RsvpStatusValue>(
      (value) =>
        typeof value === "string" &&
        (RSVP_STATUSES as readonly string[]).includes(value),
      { error: R.badStatus }
    )
  );

/** DELETE reads user_id only. */
export const RsvpDeleteBody = z.object({ user_id: presentUserId });

export type RsvpBodyInput = z.input<typeof RsvpBody>;
export type RsvpBodyOutput = z.infer<typeof RsvpBody>;
export type RsvpDeleteBodyInput = z.input<typeof RsvpDeleteBody>;
export type RsvpDeleteBodyOutput = z.infer<typeof RsvpDeleteBody>;

// ─── POST /api/events/[id]/invite ────────────────────────────────────────────

/**
 * A non-empty array. Its elements are matched against the caller's friend
 * ids in the handler; an element that is not one (whatever its type) is
 * dropped there, as before.
 */
export const EventInviteBody = z.object({
  invitee_ids: z.custom<unknown[]>(
    (value) => Array.isArray(value) && value.length > 0,
    { error: "No invitees provided" }
  ),
});

export type EventInviteBodyInput = z.input<typeof EventInviteBody>;
export type EventInviteBodyOutput = z.infer<typeof EventInviteBody>;

// ─── POST /api/events/[id]/reviews ───────────────────────────────────────────

export const ReviewBody = z.object({
  rating: z.custom<number>(
    (value) =>
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 5,
    { error: "Rating must be an integer between 1 and 5" }
  ),
  comment: asSent(),
});

export type ReviewBodyInput = z.input<typeof ReviewBody>;
export type ReviewBodyOutput = z.infer<typeof ReviewBody>;

// ─── POST /api/events/[id]/report ────────────────────────────────────────────

export const EventReportBody = z.object({
  category: z.custom<RejectionCategory>(
    (value) =>
      typeof value === "string" &&
      Object.prototype.hasOwnProperty.call(REJECTION_CATEGORIES, value),
    { error: "Invalid category" }
  ),
  // Falsy is stored as null by the handler; text is sanitized and cut there.
  message: z
    .custom<string | null | undefined>(
      (value) => !value || typeof value === "string",
      { error: "Message must be a string" }
    )
    .optional(),
});

export type EventReportBodyInput = z.input<typeof EventReportBody>;
export type EventReportBodyOutput = z.infer<typeof EventReportBody>;

// ─── POST /api/events/[id]/appeal ────────────────────────────────────────────

export const EventAppealBody = z.object({
  message: NonEmptyTrimmedString("Appeal message is required"),
});

export type EventAppealBodyInput = z.input<typeof EventAppealBody>;
export type EventAppealBodyOutput = z.infer<typeof EventAppealBody>;

// ─── POST /api/events/upload-image (multipart) ───────────────────────────────

/** The route reads no field besides the file. */
export const UploadImageForm = z.object({});

/**
 * The multipart field the route reads the image from. A client sender types
 * its `formData.append` name as EventImageFileField through an `import type`
 * (plan 06-11, REFAC-16), so nothing from this module ships to the browser.
 */
export const EVENT_IMAGE_FILE_FIELD = "file";
export type EventImageFileField = typeof EVENT_IMAGE_FILE_FIELD;

/**
 * The route's file rule, texts and order (size before type), and its answer
 * to an unreadable form (its catch's 500, unchanged).
 */
export const EVENT_IMAGE_UPLOAD: FormOptions = {
  file: {
    field: EVENT_IMAGE_FILE_FIELD,
    types: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    maxBytes: 5 * 1024 * 1024,
    order: ["size", "type"],
    messages: {
      missing: "No file provided",
      tooLarge: "File too large. Maximum size is 5MB",
      badType: (type) =>
        `Invalid file type "${type}". Allowed: JPEG, PNG, WebP, GIF.`,
    },
  },
  unreadable: { status: 500, error: "Internal server error" },
};

// ─── Mutations that read no body (plan 06-11, REFAC-16) ──────────────────────

/** POST and DELETE /api/events/[id]/save read only the route id. */
export type EventSaveRequestInit = BodilessRequestInit;

/** DELETE /api/events/[id] reads only the route id (PATCH reads EventUpdateBody). */
export type EventDeleteRequestInit = BodilessRequestInit;

// ─── Query helpers ───────────────────────────────────────────────────────────

/** `searchParams.get(key)`: the string as sent, or null when absent. */
const queryText = () =>
  z
    .string()
    .optional()
    .transform((value) => value ?? null);

/** `parseInt(get(key) || fallback, 10)`: NaN included, never a 400. */
const queryInt = (fallback: string) =>
  z
    .string()
    .optional()
    .transform((value) => parseInt(value || fallback, 10));

/** The export route's UUID test (any case, no version check; kept as sent). */
const EXPORT_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── GET /api/events ─────────────────────────────────────────────────────────

export const TIME_OF_DAY_VALUES = [
  "morning",
  "afternoon",
  "evening",
  "night",
] as const;
export const DAY_TYPE_VALUES = ["weekday", "weekend"] as const;

export const EVENTS_LIST_MESSAGES = {
  limit: "limit must be an integer from 1 to 100",
  page: "page must be a positive integer",
  timeOfDay: `Invalid timeOfDay value. Must be one of: ${TIME_OF_DAY_VALUES.join(", ")}`,
  dayType: `Invalid dayType value. Must be one of: ${DAY_TYPE_VALUES.join(", ")}`,
  cursor: "Invalid cursor",
} as const;

/** The list's limit and page 400s carry field (pinned by the list suites). */
export const EVENTS_LIST_FIELD_KEYS = ["limit", "page"] as const;

const L = EVENTS_LIST_MESSAGES;

/**
 * The list's ladder, in its order: limit, page, timeOfDay, dayType, cursor.
 * An empty timeOfDay or dayType is not refused and stays "" (the handler
 * tested truthiness); an empty cursor is absent. The other filters are read
 * as sent.
 */
export const EventsListQuery = z.object({
  limit: queryInt("50").refine(
    (value) => Number.isInteger(value) && value >= 1 && value <= 100,
    { error: L.limit }
  ),
  page: queryInt("1").refine(
    (value) => Number.isInteger(value) && value >= 1,
    { error: L.page }
  ),
  timeOfDay: queryText().refine(
    (value) =>
      !value || (TIME_OF_DAY_VALUES as readonly string[]).includes(value),
    { error: L.timeOfDay }
  ),
  dayType: queryText().refine(
    (value) => !value || (DAY_TYPE_VALUES as readonly string[]).includes(value),
    { error: L.dayType }
  ),
  cursor: z
    .string()
    .optional()
    .transform((value, ctx): EventCursor | null => {
      if (!value) return null;
      const cursor = decodeEventCursor(value);
      if (!cursor) {
        ctx.issues.push({ code: "custom", message: L.cursor, input: value });
        return z.NEVER;
      }
      return cursor;
    }),
  tags: queryText(),
  search: queryText(),
  dateFrom: queryText(),
  dateTo: queryText(),
  ids: queryText(),
});

export type EventsListQueryInput = z.input<typeof EventsListQuery>;
export type EventsListQueryOutput = z.infer<typeof EventsListQuery>;

// ─── GET /api/events/export ──────────────────────────────────────────────────

export const EXPORT_MESSAGES = {
  format: "format parameter must be 'csv' or 'ical'",
  eventId: "eventId must be a valid UUID",
  eventIds: "eventIds must be a comma-separated list of valid UUIDs",
  both: "Provide either eventId or eventIds, not both",
} as const;

const X = EXPORT_MESSAGES;

/**
 * format, then eventId, then each of eventIds (split on commas, trimmed,
 * blanks dropped), then "not both". Ids keep the case they were sent in.
 */
export const ExportQuery = z
  .object({
    format: z.custom<"csv" | "ical">(
      (value) => value === "csv" || value === "ical",
      { error: X.format }
    ),
    eventId: queryText().refine((value) => !value || EXPORT_UUID.test(value), {
      error: X.eventId,
    }),
    eventIds: z
      .string()
      .optional()
      .transform((value) =>
        value
          ? value
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean)
          : []
      )
      .refine((ids) => ids.every((id) => EXPORT_UUID.test(id)), {
        error: X.eventIds,
      }),
    tags: queryText(),
    search: queryText(),
    dateFrom: queryText(),
    dateTo: queryText(),
    clubId: queryText(),
  })
  .superRefine((query, ctx) => {
    if (query.eventId && query.eventIds.length > 0) {
      ctx.addIssue({ code: "custom", message: X.both });
    }
  });

export type ExportQueryInput = z.input<typeof ExportQuery>;
export type ExportQueryOutput = z.infer<typeof ExportQuery>;

// ─── GET /api/events/popular ─────────────────────────────────────────────────

export const POPULAR_SORTS = ["popularity", "trending"] as const;
export type PopularSort = (typeof POPULAR_SORTS)[number];

/**
 * sort (default popularity) is the one 400. limit is capped at 50, offset and
 * min_score parse with today's defaults; none of them is ever refused.
 */
export const PopularQuery = z.object({
  sort: z
    .string()
    .optional()
    .transform((value) => value || "popularity")
    .pipe(
      z.custom<PopularSort>(
        (value) => (POPULAR_SORTS as readonly unknown[]).includes(value),
        { error: "sort must be 'popularity' or 'trending'" }
      )
    ),
  limit: queryInt("10").transform((value) => Math.min(value, 50)),
  offset: queryInt("0"),
  min_score: z
    .string()
    .optional()
    .transform((value) => parseFloat(value || "0")),
});

export type PopularQueryInput = z.input<typeof PopularQuery>;
export type PopularQueryOutput = z.infer<typeof PopularQuery>;

// ─── GET /api/calendar/events ────────────────────────────────────────────────

/** from and to pass to the query as sent (no 400 today; garbage included). */
export const CalendarQuery = z.object({
  from: queryText(),
  to: queryText(),
});

export type CalendarQueryOutput = z.infer<typeof CalendarQuery>;

// ─── Responses the client reads (plan 06-11, REFAC-16, DEC-67) ───────────────
//
// Checked in development only, by the hooks, through checkResponseInDev
// (src/lib/contractCheck.ts); a hook loads these with a dynamic import inside
// a NODE_ENV branch, so they never reach a production client chunk. Every
// object is loose: an extra key is not drift, so a warning means a key the
// client reads has changed. Each lists what the handler returns on its
// success arm and what the client reads, no more.

/** One event row as the list and the joins return it: an id at least. */
const EventRowShape = z.looseObject({ id: z.string() });

/**
 * GET /api/events, 200 (every success arm, including the empty ones):
 * useEvents reads events, total, nextCursor and prevCursor. The handler also
 * sends page, limit and totalPages, which no client reads.
 */
export const EventsListResponse = z.looseObject({
  events: z.array(EventRowShape),
  total: z.number(),
  nextCursor: z.string().nullable(),
  prevCursor: z.string().nullable(),
});

export type EventsListResponseBody = z.infer<typeof EventsListResponse>;

/**
 * GET /api/events/featured, 200: `{ featured }`, each a featured_events row
 * with its approved, live event joined (the handler drops the rest).
 */
export const FeaturedEventsResponse = z.looseObject({
  featured: z.array(
    z.looseObject({
      id: z.string(),
      event_id: z.string(),
      priority: z.number(),
      starts_at: z.string(),
      ends_at: z.string(),
      event: EventRowShape,
    })
  ),
});

export type FeaturedEventsResponseBody = z.infer<typeof FeaturedEventsResponse>;

/**
 * GET /api/events/[id]/analytics, 200. The handler sends no rsvp_cancelled
 * (the EventAnalytics type in src/types declares one); the schema lists what
 * is sent, so the check stays quiet about that known gap.
 */
export const EventAnalyticsResponse = z.looseObject({
  event_id: z.string(),
  title: z.string(),
  start_date: z.string(),
  views: z.number(),
  clicks: z.number(),
  saves: z.number(),
  unique_viewers: z.number(),
  rsvp_going: z.number(),
  rsvp_interested: z.number(),
});

export type EventAnalyticsResponseBody = z.infer<typeof EventAnalyticsResponse>;

/** GET /api/events/[id]/reviews, 200: the aggregate, the caller's review, eligibility. */
export const EventReviewsResponse = z.looseObject({
  aggregate: z.looseObject({
    average_rating: z.number(),
    total_reviews: z.number(),
    distribution: z.array(
      z.looseObject({ rating: z.number(), count: z.number() })
    ),
    comments: z.array(
      z.looseObject({
        rating: z.number(),
        comment: z.string(),
        created_at: z.string(),
      })
    ),
  }),
  user_review: z
    .looseObject({
      id: z.string(),
      rating: z.number(),
      comment: z.string().nullable(),
      created_at: z.string(),
    })
    .nullable(),
  can_review: z.boolean(),
});

export type EventReviewsResponseBody = z.infer<typeof EventReviewsResponse>;

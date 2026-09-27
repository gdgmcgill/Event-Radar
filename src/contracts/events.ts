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
 */
import { z } from "zod";
import { NonEmptyTrimmedString } from "@/contracts/common";
import { isValidISODate, validateEventDates } from "@/lib/dateValidation";
import { sanitizeText } from "@/lib/sanitize";
import { REJECTION_CATEGORIES, type RejectionCategory } from "@/types";
import type { FormOptions } from "@/server/body";

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

export type EventReportBodyOutput = z.infer<typeof EventReportBody>;

// ─── POST /api/events/[id]/appeal ────────────────────────────────────────────

export const EventAppealBody = z.object({
  message: NonEmptyTrimmedString("Appeal message is required"),
});

export type EventAppealBodyOutput = z.infer<typeof EventAppealBody>;

// ─── POST /api/events/upload-image (multipart) ───────────────────────────────

/** The route reads no field besides the file. */
export const UploadImageForm = z.object({});

/**
 * The route's file rule, texts and order (size before type), and its answer
 * to an unreadable form (its catch's 500, unchanged).
 */
export const EVENT_IMAGE_UPLOAD: FormOptions = {
  file: {
    field: "file",
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

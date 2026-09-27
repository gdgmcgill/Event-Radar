/**
 * Contracts for the admin and moderation families (plan 06-10, REFAC-15,
 * DEC-65, DEC-66, DEC-80).
 *
 * EVERY MESSAGE IS TODAY'S, IN TODAY'S ORDER. The texts and the order the
 * handlers checked them in are pinned by the 06-07 table
 * (src/__tests__/contracts/badRequestTable.ts, bad-request-characterization)
 * and the admin PRESERVE suites, which pass unedited against these schemas.
 * Keys are declared in check order because zod reports issues in declaration
 * order and parseWith answers the first. An object-level refinement runs only
 * when every key passed, which is where the handlers checked a rule that
 * reads two keys (a rejection's category and message, an edit rejection's
 * reason, the featured "No fields to update").
 *
 * WHERE A GUARD OR A DATABASE RULE SITS BETWEEN TWO INPUT CHECKS, THE
 * CONTRACT IS SPLIT (the 06-08 RSVP precedent), so the order holds:
 *   - admin/events/[id]/status checks the status, then the transition read
 *     (404, 409), then the rejection or suspension reason: EventStatusBody,
 *     then ModerationReason through parseWith;
 *   - admin/users/[id] checks the roles, then the own-roles 403, then the
 *     name: AdminUserUpdateBody, then AdminUserNameBody.
 * Business rules stay in the handlers (C11): own account ban, no pending
 * edits, draft-only experiment delete, the transition guards.
 *
 * `field` IS EMITTED ONLY WHERE IT WAS (C10): admin/users/[id] names `roles`
 * and `name` through fieldFor. Nothing else here carries field.
 *
 * VALUES THE HANDLERS DID NOT CHECK ARE PASSED AS SENT (`z.any().optional()`,
 * the type request.json() gave them, no new 400), except where the value is
 * written to a typed column through one of the four DI-53 payloads.
 *
 * DI-53 (DEC-80). AdminEventUpdateBody, ExperimentUpdateBody and
 * FeaturedUpdateBody parse to objects assignable to TablesUpdate<"events">,
 * TablesUpdate<"experiments"> and TablesUpdate<"featured_events">, so the
 * routes build their update payloads from them with no Record and no cast,
 * and supabase-js 2.116.0's RejectExcessProperties accepts them. Each column
 * type is the generated one: nullable where the column is, so every value the
 * moderation UI sends still parses.
 *
 * F-094 (INTENTIONAL BEHAVIOUR CHANGE). A body that is not JSON answers 400
 * `Invalid JSON body` and a non-object body 400 `Request body must be a JSON
 * object` (parseBody) at the six raw sites. A wrongly typed value answers a
 * 400 where it used to be written as-is, coerced by sanitizeText or thrown on:
 *   - the handler's own required text where one exists (a numeric admin event
 *     title, experiment name, rejection or suspension message);
 *   - a new text where none existed: `<field> must be a string` or `<field>
 *     must be a string or null` (admin event PUT fields, admin event POST
 *     description and location, experiment description and end_date,
 *     featured sponsor_name, starts_at and ends_at), `tags must be an array
 *     of strings or null`, `priority must be an integer`, and `Invalid
 *     status` for an experiment status outside the table's check constraint.
 * A rejection category is looked up as an own key, so an inherited name such
 * as "toString" is refused like any unknown category (the 06-08 report rule).
 */
import { z } from "zod";
import { NonEmptyTrimmedString } from "@/contracts/common";
import { sanitizeText } from "@/lib/sanitize";
import { Constants } from "@/lib/supabase/types";
import { REJECTION_CATEGORIES, type RejectionCategory } from "@/types";

// ─── Shared ──────────────────────────────────────────────────────────────────

/** A key the handler read as sent, with no rule: typed as request.json() typed it. */
const asSent = () => z.any().optional();

/** A string column, with the handler's `<field> must be a string` text. */
function text(field: string) {
  return z.string({ error: `${field} must be a string` });
}

/** A nullable string column. */
function nullableText(field: string) {
  return z.string({ error: `${field} must be a string or null` }).nullable();
}

function isRejectionCategory(value: unknown): value is RejectionCategory {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(REJECTION_CATEGORIES, value)
  );
}

// ─── Moderation decisions: admin/clubs/[id], admin/events/[id]/status ───────

export const DECISION_STATUSES = ["approved", "rejected", "suspended"] as const;

/**
 * The parsed decision. A rejection or a suspension carries a checked
 * category and message (the handler trims the message where it stores it);
 * an approval carries neither, whatever was sent.
 */
export type ModerationDecision =
  | { status: "approved"; category: null; message: null }
  | {
      status: "rejected" | "suspended";
      category: RejectionCategory;
      message: string;
    };

/**
 * The reason rule of a rejection or a suspension, in the handlers' order:
 * a category and a non-blank message are required, then the category must
 * be one of REJECTION_CATEGORIES. A non-string message answers the required
 * text (F-094: `.trim()` on it threw with no try).
 */
export const ModerationReason = z
  .object({
    status: z.enum(DECISION_STATUSES),
    category: z.unknown().optional(),
    message: z.unknown().optional(),
  })
  .superRefine(({ status, category, message }, ctx) => {
    if (status === "approved") return;
    const rejected = status === "rejected";
    if (
      !category ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: rejected
          ? "Rejection requires category and message"
          : "Suspension requires category and message",
        path: [category ? "message" : "category"],
      });
      return;
    }
    if (!isRejectionCategory(category)) {
      ctx.addIssue({
        code: "custom",
        message: rejected
          ? "Invalid rejection category"
          : "Invalid suspension category",
        path: ["category"],
      });
    }
  })
  .transform(
    ({ status, category, message }): ModerationDecision =>
      status === "approved"
        ? { status, category: null, message: null }
        : {
            status,
            category: category as RejectionCategory,
            message: message as string,
          }
  );

/** A decision's status and the two reason keys, as sent. */
function decisionShape(statusMessage: string) {
  return z.object({
    status: z.enum(DECISION_STATUSES, { error: statusMessage }),
    category: z.unknown().optional(),
    message: z.unknown().optional(),
  });
}

/** PATCH /api/admin/clubs/[id]: the status, then the reason, with no read between. */
export const AdminClubDecisionBody = decisionShape(
  "Status must be 'approved', 'rejected', or 'suspended'"
).pipe(ModerationReason);

export type AdminClubDecisionBodyInput = z.input<typeof AdminClubDecisionBody>;

/**
 * PATCH /api/admin/events/[id]/status, first stage: the status only. The
 * route then reads the event and applies the transition guard (404, 409)
 * before it parses ModerationReason from this output.
 */
export const EventStatusBody = decisionShape("Invalid status");

export type EventStatusBodyInput = z.input<typeof EventStatusBody>;

// ─── PATCH /api/admin/events/[id]/edits ──────────────────────────────────────

export const EventEditsDecisionBody = z
  .object({
    action: z.enum(["approve", "reject"], {
      error: "action must be 'approve' or 'reject'",
    }),
    // Kept as sent: the handler only required it to be truthy on a reject.
    reason: asSent(),
  })
  .superRefine(({ action, reason }, ctx) => {
    if (action === "reject" && !reason) {
      ctx.addIssue({
        code: "custom",
        message: "reason is required when rejecting edits",
        path: ["reason"],
      });
    }
  });

export type EventEditsDecisionBodyInput = z.input<typeof EventEditsDecisionBody>;

// ─── POST /api/admin/events ──────────────────────────────────────────────────

const ADMIN_EVENT_REQUIRED = "title, start_date, and end_date are required";

/**
 * Optional text the handler sanitized: a string, or null/absent (stored "").
 * `.optional()` before the transform, so an absent key still yields "".
 */
function sanitizedOptional(field: string) {
  return z
    .custom<string | null>(
      (value) => value === null || typeof value === "string",
      { error: `${field} must be a string` }
    )
    .optional()
    .transform((value) => sanitizeText(value ?? ""));
}

export const AdminEventCreateBody = z.object({
  title: z
    .custom<string>(
      (value) => typeof value === "string" && sanitizeText(value) !== "",
      { error: ADMIN_EVENT_REQUIRED }
    )
    .transform((value) => sanitizeText(value)),
  // Presence only, as the handler checked them.
  start_date: z.custom<string>((value) => Boolean(value), {
    error: ADMIN_EVENT_REQUIRED,
  }),
  end_date: z.custom<string>((value) => Boolean(value), {
    error: ADMIN_EVENT_REQUIRED,
  }),
  description: sanitizedOptional("description"),
  location: sanitizedOptional("location"),
  organizer: asSent(),
  tags: asSent(),
  image_url: asSent(),
  category: asSent(),
});

export type AdminEventCreateBodyInput = z.input<typeof AdminEventCreateBody>;
export type AdminEventCreateBodyOutput = z.infer<typeof AdminEventCreateBody>;

// ─── PUT /api/admin/events/[id] (DI-53 site 2) ───────────────────────────────

/**
 * The ten fields an admin may set, in the handler's allowedFields order,
 * each typed as its events column. Only the keys sent are kept.
 */
export const AdminEventUpdateBody = z
  .object({
    title: text("title"),
    description: nullableText("description"),
    start_date: text("start_date"),
    end_date: text("end_date"),
    location: nullableText("location"),
    organizer: nullableText("organizer"),
    tags: z
      .custom<string[]>(
        (value) =>
          Array.isArray(value) &&
          value.every((tag) => typeof tag === "string"),
        { error: "tags must be an array of strings or null" }
      )
      .nullable(),
    image_url: nullableText("image_url"),
    category: nullableText("category"),
    status: text("status"),
  })
  .partial();

export type AdminEventUpdateBodyOutput = z.infer<typeof AdminEventUpdateBody>;

/**
 * The PUT body: the allowed fields as `updates`, and every key sent as
 * `sent`, because the audit row names every key of the body
 * (`fields_updated: Object.keys(body)`), as before.
 */
export const AdminEventPutBody = z
  .record(z.string(), z.unknown())
  .transform((body) => ({ sent: Object.keys(body), updates: body }))
  .pipe(
    z.object({ sent: z.array(z.string()), updates: AdminEventUpdateBody })
  );

export type AdminEventPutBodyInput = z.input<typeof AdminEventPutBody>;

// ─── POST /api/admin/experiments ─────────────────────────────────────────────

/** A variant as the handler read it (the elements are not checked). */
export interface ExperimentVariantInput {
  name: string;
  config?: Record<string, unknown>;
  weight?: number;
}

export const ExperimentCreateBody = z.object({
  name: z.custom<string>(
    (value) => typeof value === "string" && value.length > 0,
    { error: "name is required" }
  ),
  variants: z.custom<ExperimentVariantInput[]>(
    (value) => Array.isArray(value) && value.length >= 2,
    { error: "At least 2 variants are required" }
  ),
  description: asSent(),
  target_metric: asSent(),
  start_date: asSent(),
  end_date: asSent(),
});

export type ExperimentCreateBodyInput = z.input<typeof ExperimentCreateBody>;

// ─── PATCH /api/admin/experiments/[id] (DI-53 site 3) ────────────────────────

/** The experiments_status_check constraint's values (baseline migration). */
export const EXPERIMENT_STATUSES = [
  "draft",
  "running",
  "paused",
  "completed",
] as const;

export const ExperimentUpdateBody = z.object({
  status: z.enum(EXPERIMENT_STATUSES, { error: "Invalid status" }).optional(),
  description: nullableText("description").optional(),
  end_date: nullableText("end_date").optional(),
});

export type ExperimentUpdateBodyInput = z.input<typeof ExperimentUpdateBody>;
export type ExperimentUpdateBodyOutput = z.infer<typeof ExperimentUpdateBody>;

// ─── POST and PATCH /api/admin/featured (DI-53 site 4) ───────────────────────

/** A sponsor name: any falsy value, or a string. */
function sponsorNameInput() {
  return z.custom<string | null | undefined>(
    (value) => !value || typeof value === "string",
    { error: "sponsor_name must be a string" }
  );
}

/** Sanitized when truthy, null when falsy (as both handlers stored it). */
const toSponsorName = (value: string | null | undefined) =>
  value ? sanitizeText(value) : null;

const FEATURED_REQUIRED = "event_id, starts_at, and ends_at are required";

export const FeaturedCreateBody = z.object({
  event_id: z.custom<string>((value) => Boolean(value), {
    error: FEATURED_REQUIRED,
  }),
  starts_at: z.custom<string>((value) => Boolean(value), {
    error: FEATURED_REQUIRED,
  }),
  ends_at: z.custom<string>((value) => Boolean(value), {
    error: FEATURED_REQUIRED,
  }),
  // An absent name is null, exactly what the handler stored.
  sponsor_name: sponsorNameInput().optional().transform(toSponsorName),
  priority: asSent(),
});

export type FeaturedCreateBodyInput = z.input<typeof FeaturedCreateBody>;

export const FeaturedUpdateBody = z
  .object({
    // Only when sent: an absent key stays absent ("No fields to update").
    sponsor_name: sponsorNameInput().transform(toSponsorName).optional(),
    priority: z
      .number({ error: "priority must be an integer" })
      .int({ error: "priority must be an integer" })
      .optional(),
    starts_at: text("starts_at").optional(),
    ends_at: text("ends_at").optional(),
  })
  .refine((updates) => Object.keys(updates).length > 0, {
    error: "No fields to update",
  });

export type FeaturedUpdateBodyInput = z.input<typeof FeaturedUpdateBody>;
export type FeaturedUpdateBodyOutput = z.infer<typeof FeaturedUpdateBody>;

// ─── PATCH /api/admin/organizer-requests/[id], /api/admin/reports/[id] ───────

export const OrganizerRequestDecisionBody = z.object({
  status: z.enum(["approved", "rejected"], {
    error: "Status must be 'approved' or 'rejected'",
  }),
});

export type OrganizerRequestDecisionBodyInput = z.input<
  typeof OrganizerRequestDecisionBody
>;

export const ReportDecisionBody = z.object({
  status: z.enum(["reviewed", "dismissed"], { error: "Invalid status" }),
});

export type ReportDecisionBodyInput = z.input<typeof ReportDecisionBody>;

// ─── POST /api/admin/users/[id]/ban ──────────────────────────────────────────

export const BanBody = z.object({
  reason: NonEmptyTrimmedString("Reason is required"),
  // Absent or null is a permanent ban.
  duration_days: z
    .custom<number | null>(
      (value) =>
        value === null ||
        (typeof value === "number" && Number.isInteger(value) && value > 0),
      { error: "duration_days must be a positive integer" }
    )
    .optional(),
  suspend_content: asSent(),
});

export type BanBodyInput = z.input<typeof BanBody>;

// ─── PATCH /api/admin/users/[id] ─────────────────────────────────────────────

export type UserRoleValue = (typeof Constants.public.Enums.user_role)[number];

const USER_ROLES: readonly string[] = Constants.public.Enums.user_role;

function isUserRole(value: unknown): value is UserRoleValue {
  return typeof value === "string" && USER_ROLES.includes(value);
}

/**
 * First stage: every role must be a user_role enum member (F-091, DEC-45).
 * The name is passed as sent: the own-roles 403 sits between the two checks.
 */
export const AdminUserUpdateBody = z.object({
  roles: z
    .custom<UserRoleValue[]>(
      (value) => Array.isArray(value) && value.every(isUserRole),
      { error: "Invalid role" }
    )
    .optional(),
  name: asSent(),
});

export type AdminUserUpdateBodyInput = z.input<typeof AdminUserUpdateBody>;

/** Bounds on an admin-set display name (REVIEW-05 WR-08). */
export const ADMIN_NAME_MIN = 2;
export const ADMIN_NAME_MAX = 50;

/** Second stage: a trimmed string of 2 to 50 characters, when sent. */
export const AdminUserNameBody = z.object({
  name: z
    .custom<string>(
      (value) =>
        typeof value === "string" &&
        value.trim().length >= ADMIN_NAME_MIN &&
        value.trim().length <= ADMIN_NAME_MAX,
      {
        error: `Name must be between ${ADMIN_NAME_MIN} and ${ADMIN_NAME_MAX} characters long`,
      }
    )
    .transform((value) => value.trim())
    .optional(),
});

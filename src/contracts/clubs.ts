/**
 * Contracts for the clubs and organizer-requests families (plan 06-09,
 * REFAC-15, DEC-65, DEC-66).
 *
 * EVERY MESSAGE IS TODAY'S, IN TODAY'S ORDER. The texts and the order the
 * handlers checked them in are pinned by the 06-07 table
 * (src/__tests__/contracts/badRequestTable.ts, bad-request-characterization),
 * the club-links suite and the club PRESERVE suites. Keys are declared in
 * check order because zod reports issues in declaration order and parseWith
 * answers the first. Where a handler checked every key's type before any
 * key's format (clubs/[id] PATCH), the schema is a pipe of stages, because a
 * later stage runs only when the earlier one passed.
 *
 * `field` IS EMITTED WHERE IT WAS (the 06-07 correction to C10): on the
 * "Invalid value for <field>" type refusals of clubs POST and clubs/[id]
 * PATCH, and nowhere else. The link refusal ("Invalid URL for <field>"), the
 * PATCH email refusal and every other 400 are `{ error }` only, so those
 * issues carry no top-level path.
 *
 * ONE CLUB-LINK RULE (DEC-66, DI-66 retired into F-094; INTENTIONAL BEHAVIOUR
 * CHANGE). ClubLinkFields holds the rule for the six link keys on POST and
 * PATCH alike: an absolute http(s) URL is kept as sent; a scheme-less host
 * path (a value that is not an absolute URL and, with `https://` in front,
 * parses to a URL whose host has a dot) is stored with `https://` prefixed;
 * anything else, another scheme (`javascript:`, `data:`, `ftp:`) or a value
 * that is neither a URL nor a host path, answers 400 `Invalid URL for
 * <field>`. Before, POST stored "yourclub.com" verbatim (a relative link on
 * the club page) and PATCH refused it, so the settings form could not save a
 * link the create form had accepted. instagram_handle is a handle, not a
 * link, and only its type is checked, as before.
 *
 * VALUES THE HANDLERS DID NOT CHECK ARE PASSED AS SENT. A key a handler read
 * without a rule is `z.any().optional()`: it keeps the type `request.json()`
 * gave it and gains no 400 (C11). A presence rule is the handler's truthiness
 * test, so a truthy id of another type still reaches the handler's lookup or
 * comparison as before (a numeric memberId still answers the 404). Business
 * rules evaluated after a guard or a database read stay in the handlers: the
 * DELETE confirmation-name match, the transfer self and membership rules, the
 * member and role owner/self rules.
 *
 * F-094 (INTENTIONAL BEHAVIOUR CHANGE). A body that is not JSON answers 400
 * `Invalid JSON body` and a non-object body 400 `Request body must be a JSON
 * object` (parseBody), at the three raw sites that answered a 500 or their
 * first "missing" text. A non-string where the handler sanitized or trimmed
 * text answers that field's required text: the POST name, description and
 * category (a number was coerced to "5" by sanitizeText), the invite email
 * and the appeal message (a number threw on `.trim()`).
 */
import { z } from "zod";
import { NonEmptyTrimmedString } from "@/contracts/common";
import { sanitizeText } from "@/lib/sanitize";
import { isMcGillEmail } from "@/lib/utils";
import type { FormOptions } from "@/server/body";

// ─── Shared ──────────────────────────────────────────────────────────────────

/** A key the handler read as sent, with no rule: typed as request.json() typed it. */
const asSent = () => z.any().optional();

/**
 * A truthy value, as the handler's `if (!value)` tested it. Typed string (the
 * handler's own cast); a truthy value of another type reaches the handler's
 * query or comparison exactly as it did.
 */
function present(message: string) {
  return z.custom<string>((value) => Boolean(value), { error: message });
}

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LINK_PROTOCOLS = ["http:", "https:"];

// ─── The one club-link rule (DEC-66) ─────────────────────────────────────────

/** The six link keys, in the order clubs/[id] PATCH checked them. */
export const CLUB_LINK_KEYS = [
  "website_url",
  "discord_url",
  "twitter_url",
  "linkedin_url",
  "logo_url",
  "banner_url",
] as const;

export type ClubLinkKey = (typeof CLUB_LINK_KEYS)[number];

/**
 * The value to store for a string link, or null when it is refused. An
 * absolute http(s) URL (tested on the trimmed value, as both handlers did) is
 * returned exactly as sent, since each handler applies its own trim. A
 * scheme-less host path comes back trimmed with `https://` in front. A blank
 * string is returned as sent for the handler to clear.
 */
export function normalizeClubLink(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return value;

  let absolute: URL | null;
  try {
    absolute = new URL(trimmed);
  } catch {
    absolute = null;
  }
  if (absolute) return LINK_PROTOCOLS.includes(absolute.protocol) ? value : null;

  try {
    const prefixed = `https://${trimmed}`;
    return new URL(prefixed).hostname.includes(".") ? prefixed : null;
  } catch {
    return null;
  }
}

/** The link refusal: `{ error }` only, as both handlers answered it. */
function linkRefusal(field: string, input: unknown) {
  return { code: "custom" as const, message: `Invalid URL for ${field}`, input };
}

/**
 * ClubLinkFields: the DEC-66 rule over an object's link keys, in PATCH's
 * order. Each present string link is replaced by the value to store, or the
 * object is refused with `Invalid URL for <field>` (no `field`). Absent keys,
 * null (a clear) and every other key pass through untouched; a link's type is
 * each route's own rule, checked before this one. clubs/[id] PATCH pipes its
 * whitelisted values through it; clubs POST applies it one field at a time,
 * right after that field's type check, which is the order POST checked in.
 */
export const ClubLinkFields = z
  .looseObject({})
  .transform((body, ctx): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...body };
    for (const field of CLUB_LINK_KEYS) {
      const value = body[field];
      if (typeof value !== "string") continue;
      const stored = normalizeClubLink(value);
      if (stored === null) {
        ctx.issues.push(linkRefusal(field, value));
        return z.NEVER;
      }
      out[field] = stored;
    }
    return out;
  });

// ─── POST /api/clubs ─────────────────────────────────────────────────────────

export const CLUB_CREATE_MESSAGES = {
  required: "Name, description, and category are required",
  contactEmail: "Contact email is required",
  email: "Please provide a valid email address",
  lengths: "Name max 100 chars, description max 500 chars",
} as const;

const CC = CLUB_CREATE_MESSAGES;

/** The optional text fields, in the order the POST handler walked them. */
export const CLUB_CREATE_OPTIONAL_KEYS = [
  "logo_url",
  "instagram_handle",
  "website_url",
  "discord_url",
  "twitter_url",
  "linkedin_url",
] as const;

/** The POST keys whose 400 carries `field`: the optional-text type refusals. */
export const CLUB_CREATE_FIELD_KEYS = CLUB_CREATE_OPTIONAL_KEYS;

/**
 * Stage 1: each optional field is a string, null or absent ("Invalid value
 * for <field>", with field), then, for a link, the DEC-66 rule. Field by
 * field, so a bad logo_url link answers before a bad website_url type, as the
 * handler's loop did.
 */
const createOptionalText = z
  .looseObject({})
  .transform((body, ctx): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...body };
    for (const field of CLUB_CREATE_OPTIONAL_KEYS) {
      const value = body[field];
      if (value !== undefined && value !== null && typeof value !== "string") {
        ctx.issues.push({
          code: "custom",
          message: `Invalid value for ${field}`,
          path: [field],
          input: value,
        });
        return z.NEVER;
      }
      if (field === "instagram_handle" || typeof value !== "string") continue;
      const link = ClubLinkFields.safeParse({ [field]: value });
      if (!link.success) {
        ctx.issues.push(linkRefusal(field, value));
        return z.NEVER;
      }
      out[field] = link.data[field];
    }
    return out;
  });

/** Nullish sanitizes to "" (the handler's `?? ""`); any other non-string is refused. */
const sanitizedRequired = z
  .custom<string | null | undefined>(
    (value) =>
      (value === undefined || value === null || typeof value === "string") &&
      sanitizeText(value ?? "") !== "",
    { error: CC.required }
  )
  .transform((value) => sanitizeText(value ?? ""));

/** Stage 2: the required fields in the handler's order, then the lengths. */
const createRequired = z
  .object({
    name: sanitizedRequired,
    description: sanitizedRequired,
    category: sanitizedRequired,
    contact_email: z
      .custom<string>((value) => Boolean(value) && typeof value === "string", {
        error: CC.contactEmail,
      })
      .pipe(
        z.custom<string>(
          (value) => typeof value === "string" && EMAIL_FORMAT.test(value.trim()),
          { error: CC.email }
        )
      ),
    logo_url: asSent(),
    instagram_handle: asSent(),
    website_url: asSent(),
    discord_url: asSent(),
    twitter_url: asSent(),
    linkedin_url: asSent(),
  })
  .superRefine((body, ctx) => {
    if (body.name.length > 100 || body.description.length > 500) {
      ctx.addIssue({ code: "custom", message: CC.lengths });
    }
  });

/**
 * The optional text fields first (their loop ran before the required
 * checks), then name, description, category, contact email, its format and
 * the lengths. name, description and category come out sanitized; the email
 * and the optional fields come out as sent (links normalized by DEC-66), and
 * the handler still trims what it trimmed.
 */
export const ClubCreateBody = createOptionalText.pipe(createRequired);

export type ClubCreateBodyInput = z.input<typeof createRequired>;
export type ClubCreateBodyOutput = z.infer<typeof ClubCreateBody>;

// ─── PATCH and DELETE /api/clubs/[id] ────────────────────────────────────────

/** The PATCH whitelist, in the handler's order. */
export const EDITABLE_CLUB_FIELDS = [
  "name",
  "description",
  "category",
  "instagram_handle",
  "logo_url",
  "banner_url",
  "website_url",
  "discord_url",
  "twitter_url",
  "linkedin_url",
  "contact_email",
] as const;

export type EditableClubField = (typeof EDITABLE_CLUB_FIELDS)[number];

/** The PATCH keys whose 400 carries `field`: the "Invalid value for" refusals. */
export const CLUB_UPDATE_FIELD_KEYS = EDITABLE_CLUB_FIELDS;

export const CLUB_UPDATE_MESSAGES = {
  email: "Invalid email format for contact_email",
  noFields: "No valid fields to update",
} as const;

/** A whitelisted value: a string or null, or "Invalid value for <field>". */
function stringOrNull(field: EditableClubField) {
  return z
    .custom<string | null>(
      (value) => value === null || typeof value === "string",
      { error: `Invalid value for ${field}` }
    )
    .optional();
}

/** The columns a PATCH writes: each present whitelisted key, trimmed or null. */
export type ClubUpdate = Partial<Record<EditableClubField, string | null>>;

/**
 * Stage 1 checks every whitelisted value's type, in whitelist order, and
 * keeps only whitelisted keys that were sent. Stage 2 is the handler's
 * `updates`: each value trimmed, a blank string or null cleared to null.
 * Stage 3 is ClubLinkFields. Stage 4 is the contact email format (on the
 * trimmed value) and, last, "No valid fields to update".
 */
export const ClubUpdateBody = z
  .object({
    name: stringOrNull("name"),
    description: stringOrNull("description"),
    category: stringOrNull("category"),
    instagram_handle: stringOrNull("instagram_handle"),
    logo_url: stringOrNull("logo_url"),
    banner_url: stringOrNull("banner_url"),
    website_url: stringOrNull("website_url"),
    discord_url: stringOrNull("discord_url"),
    twitter_url: stringOrNull("twitter_url"),
    linkedin_url: stringOrNull("linkedin_url"),
    contact_email: stringOrNull("contact_email"),
  })
  .transform((body): ClubUpdate => {
    const updates: ClubUpdate = {};
    for (const field of EDITABLE_CLUB_FIELDS) {
      if (!(field in body)) continue;
      const value = body[field];
      updates[field] = typeof value === "string" ? value.trim() || null : null;
    }
    return updates;
  })
  .pipe(ClubLinkFields)
  .transform((updates, ctx): ClubUpdate => {
    const email = updates.contact_email;
    if (typeof email === "string" && !EMAIL_FORMAT.test(email)) {
      ctx.issues.push({
        code: "custom",
        message: CLUB_UPDATE_MESSAGES.email,
        input: email,
      });
      return z.NEVER;
    }
    if (Object.keys(updates).length === 0) {
      ctx.issues.push({
        code: "custom",
        message: CLUB_UPDATE_MESSAGES.noFields,
        input: updates,
      });
      return z.NEVER;
    }
    return updates as ClubUpdate;
  });

export type ClubUpdateBodyInput = z.input<typeof ClubUpdateBody>;
export type ClubUpdateBodyOutput = z.infer<typeof ClubUpdateBody>;

/**
 * DELETE reads confirmName as sent; the match against the club's name is a
 * business rule after a database read and stays in the handler.
 */
export const ClubDeleteBody = z.object({ confirmName: asSent() });

export type ClubDeleteBodyOutput = z.infer<typeof ClubDeleteBody>;

// ─── POST /api/clubs/[id]/invites ────────────────────────────────────────────

/**
 * email: a non-empty string ("Email is required"; a number threw on `.trim()`,
 * F-094), then, trimmed and lower-cased as the handler normalized it, a
 * McGill address. The output is the normalized email the handler used.
 */
export const ClubInviteBody = z.object({
  email: z
    .custom<string>(
      (value) => typeof value === "string" && value !== "",
      { error: "Email is required" }
    )
    .transform((value) => value.trim().toLowerCase())
    .pipe(
      z.custom<string>(
        (value) => typeof value === "string" && isMcGillEmail(value),
        { error: "Must be a McGill email" }
      )
    ),
});

export type ClubInviteBodyInput = z.input<typeof ClubInviteBody>;
export type ClubInviteBodyOutput = z.infer<typeof ClubInviteBody>;

// ─── DELETE /api/clubs/[id]/members and PATCH .../members/role ───────────────

/** memberId as the handler tested it; the owner and self rules stay there. */
export const ClubMemberBody = z.object({
  memberId: present("memberId is required"),
});

export type ClubMemberBodyOutput = z.infer<typeof ClubMemberBody>;

const ROLE_MESSAGE = "Invalid request. Role must be 'organizer'.";

/** `!memberId || role !== "organizer"`: one message for both. */
export const ClubMemberRoleBody = z.object({
  memberId: present(ROLE_MESSAGE),
  role: z.custom<"organizer">((value) => value === "organizer", {
    error: ROLE_MESSAGE,
  }),
});

export type ClubMemberRoleBodyOutput = z.infer<typeof ClubMemberRoleBody>;

// ─── POST /api/clubs/[id]/transfer and .../appeal ────────────────────────────

/** newOwnerId as the handler tested it; the self and membership rules stay there. */
export const ClubTransferBody = z.object({
  newOwnerId: present("newOwnerId is required"),
});

export type ClubTransferBodyOutput = z.infer<typeof ClubTransferBody>;

/** The message as sent (the handler trims what it stores). */
export const ClubAppealBody = z.object({
  message: NonEmptyTrimmedString("Appeal message is required"),
});

export type ClubAppealBodyOutput = z.infer<typeof ClubAppealBody>;

// ─── POST /api/organizer-requests ────────────────────────────────────────────

/** club_id as the handler tested it (its existence is a lookup); message as sent. */
export const OrganizerRequestBody = z.object({
  club_id: present("club_id is required"),
  message: asSent(),
});

export type OrganizerRequestBodyInput = z.input<typeof OrganizerRequestBody>;
export type OrganizerRequestBodyOutput = z.infer<typeof OrganizerRequestBody>;

// ─── POST /api/clubs/logo and /api/clubs/banner (multipart) ──────────────────

const IMAGE_REQUIRED = "File and clubId are required";

/** clubId, a non-empty string; the file is parseForm's (same text). */
export const ClubImageForm = z.object({
  clubId: z.custom<string>(
    (value) => typeof value === "string" && value !== "",
    { error: IMAGE_REQUIRED }
  ),
});

export type ClubImageFormOutput = z.infer<typeof ClubImageForm>;

const CLUB_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * The file rule, texts and order (type before size) of each route. Both
 * checks run after the ownership gate, so parseForm defers them and the
 * route calls checkFile after requireClubRole. An unreadable form keeps each
 * route's catch-all 500 body.
 */
function clubImageUpload(
  maxMb: number,
  failure: string
): FormOptions {
  return {
    file: {
      field: "file",
      types: CLUB_IMAGE_TYPES,
      maxBytes: maxMb * 1024 * 1024,
      order: ["type", "size"],
      messages: {
        missing: IMAGE_REQUIRED,
        tooLarge: `File must be under ${maxMb}MB`,
        badType: "File must be JPEG, PNG, or WebP",
      },
    },
    unreadable: { status: 500, error: failure },
    deferFileChecks: true,
  };
}

export const CLUB_LOGO_UPLOAD = clubImageUpload(2, "Failed to upload logo");
export const CLUB_BANNER_UPLOAD = clubImageUpload(5, "Failed to upload banner");

// ─── GET /api/clubs/trending ─────────────────────────────────────────────────

/**
 * `Math.min(parseInt(limit ?? "15", 10) || 15, 100)`: NaN and 0 fall back to
 * 15, anything above 100 is 100, a negative passes (no 400, as before).
 */
export const TrendingQuery = z.object({
  limit: z
    .string()
    .optional()
    .transform((value) => Math.min(parseInt(value ?? "15", 10) || 15, 100)),
});

export type TrendingQueryOutput = z.infer<typeof TrendingQuery>;

// ─── Responses the client reads (plan 06-11, REFAC-16, DEC-67) ───────────────
//
// Checked in development only, by the hooks, through checkResponseInDev
// (src/lib/contractCheck.ts); a hook loads these with a dynamic import inside
// a NODE_ENV branch, so they never reach a production client chunk. Every
// object is loose: an extra key is not drift, so a warning means a key the
// client reads has changed. Each lists what the handler returns on its
// success arm, no more.

/** A clubs row (select "*"), an id and a name at least. */
const ClubRowShape = z.looseObject({ id: z.string(), name: z.string() });

/** GET /api/clubs/[id], 200: the club and its follower count. */
export const ClubResponse = z.looseObject({
  club: ClubRowShape,
  followerCount: z.number(),
});

export type ClubResponseBody = z.infer<typeof ClubResponse>;

/**
 * GET /api/clubs/[id]/events, 200: the listing and whether the caller is a
 * member. A member's rows carry rsvp_counts; the public listing's do not.
 */
export const ClubEventsResponse = z.looseObject({
  events: z.array(
    z.looseObject({
      id: z.string(),
      status: z.string(),
      rsvp_counts: z
        .looseObject({
          going: z.number(),
          interested: z.number(),
          cancelled: z.number(),
        })
        .optional(),
    })
  ),
  isOrganizer: z.boolean(),
});

export type ClubEventsResponseBody = z.infer<typeof ClubEventsResponse>;

/** GET /api/clubs/[id]/members, 200: each membership with its user (or null). */
export const ClubMembersResponse = z.looseObject({
  members: z.array(
    z.looseObject({
      id: z.string(),
      user_id: z.string(),
      role: z.string(),
      created_at: z.string(),
      user: z.looseObject({ id: z.string() }).nullable(),
    })
  ),
});

export type ClubMembersResponseBody = z.infer<typeof ClubMembersResponse>;

/** GET /api/clubs/[id]/invites, 200: a bare array of the club's invitations. */
export const ClubInvitesResponse = z.array(
  z.looseObject({
    id: z.string(),
    invitee_email: z.string(),
    status: z.string(),
    created_at: z.string(),
    expires_at: z.string(),
  })
);

export type ClubInvitesResponseBody = z.infer<typeof ClubInvitesResponse>;

/** GET /api/clubs/[id]/follow, 200: whether the caller follows the club. */
export const ClubFollowStatusResponse = z.looseObject({
  following: z.boolean(),
});

export type ClubFollowStatusResponseBody = z.infer<
  typeof ClubFollowStatusResponse
>;

/**
 * GET /api/clubs/featured, 200: `{ featured }`, each a featured_clubs row
 * with its approved club joined (the handler drops the rest).
 */
export const FeaturedClubsResponse = z.looseObject({
  featured: z.array(
    z.looseObject({
      id: z.string(),
      club_id: z.string(),
      priority: z.number(),
      starts_at: z.string(),
      ends_at: z.string(),
      club: ClubRowShape,
    })
  ),
});

export type FeaturedClubsResponseBody = z.infer<typeof FeaturedClubsResponse>;

/** GET /api/clubs/[id]/analytics, 200: the dashboard's eight series. */
export const ClubAnalyticsResponse = z.looseObject({
  follower_growth: z.array(
    z.looseObject({ date: z.string(), count: z.number() })
  ),
  total_attendees: z.number(),
  popular_tags: z.array(
    z.looseObject({ tag: z.string(), count: z.number() })
  ),
  events: z.array(
    z.looseObject({
      event_id: z.string(),
      title: z.string(),
      start_date: z.string(),
      views: z.number(),
      clicks: z.number(),
      saves: z.number(),
      unique_viewers: z.number(),
      rsvp_going: z.number(),
      rsvp_interested: z.number(),
      rsvp_cancelled: z.number(),
    })
  ),
  engagement_trend: z.array(
    z.looseObject({ date: z.string(), rate: z.number() })
  ),
  peak_hours: z.array(
    z.looseObject({ hour: z.number(), count: z.number() })
  ),
  peak_days: z.array(
    z.looseObject({ day: z.string(), count: z.number() })
  ),
  best_event_type: z
    .looseObject({
      tag: z.string(),
      avg_rsvps: z.number(),
      comparison: z.number(),
    })
    .nullable(),
});

export type ClubAnalyticsResponseBody = z.infer<typeof ClubAnalyticsResponse>;

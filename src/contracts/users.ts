/**
 * Contracts for the users, user, profile, my-clubs and onboarding families
 * (plan 06-09, REFAC-15, DEC-65).
 *
 * The input reads in these families are the ones the contracts census
 * (scripts/check-contracts.mjs) listed at users/[id] PATCH, users/saved-events
 * and users/search GET, profile/interests PUT, profile/inferred-tags DELETE and
 * the profile/avatar and profile/banner uploads. users/me/*, users/[id]/follow,
 * user/*, my-clubs and onboarding/complete read no body, query or form, so
 * they have no contract.
 *
 * EVERY MESSAGE IS TODAY'S, IN TODAY'S ORDER. The texts and the order the
 * handlers checked them in are pinned by the 06-07 table
 * (src/__tests__/contracts/badRequestTable.ts) and the user and profile
 * PRESERVE suites. Keys are declared in check order because zod reports
 * issues in declaration order and parseWith answers the first. None of these
 * routes emits `field`.
 *
 * Tag values are checked against VALID_INTEREST_TAGS (the EventTag values plus
 * the quick-filter keys), exactly the list the handlers used.
 *
 * Business rules stay in the handlers: users/[id] PATCH answers its self-only
 * 403 before the body is read, and users/[id]/follow's "Cannot follow
 * yourself" reads no body at all.
 *
 * F-094 (INTENTIONAL BEHAVIOUR CHANGE). A body that is not JSON answers 400
 * `Invalid JSON body` and a non-object body 400 `Request body must be a JSON
 * object` (parseBody), at the three raw sites that answered 500 "Internal
 * server error" (a null body threw on destructuring) or their first 400 for
 * an array. Query values keep today's silent reading: no new 400.
 */
import { z } from "zod";
import { VALID_INTEREST_TAGS } from "@/lib/constants";
import type { FormOptions } from "@/server/body";
import type { BodilessRequestInit } from "@/contracts/common";

// ─── Shared ──────────────────────────────────────────────────────────────────

/** A string or null, stored as sent (pronouns, year, faculty). */
function stringOrNull(message: string) {
  return z
    .custom<string | null>(
      (value) => value === null || typeof value === "string",
      { error: message }
    )
    .optional();
}

/**
 * An array, then every element one of VALID_INTEREST_TAGS (a non-string
 * element is simply not in the list). Stored as sent.
 */
function interestTags(notArray: string, badValue: string) {
  return z
    .custom<unknown[]>((value) => Array.isArray(value), { error: notArray })
    .pipe(
      z.custom<string[]>(
        (value) =>
          Array.isArray(value) &&
          value.every(
            (tag) => typeof tag === "string" && VALID_INTEREST_TAGS.includes(tag)
          ),
        { error: badValue }
      )
    );
}

// ─── PATCH /api/users/[id] ───────────────────────────────────────────────────

const NAME_LENGTH = "Name must be between 2 and 50 characters long";

/**
 * A profile image URL: a string or null ("<Label> URL must be a string or
 * null"); a non-blank string must parse with `new URL()` ("Invalid <Label>
 * URL format") and is stored trimmed; null or blank clears it (null). The
 * M0 / DI-90 restricts nonempty values to http(s); other URL schemes are
 * rejected before an image URL reaches storage.
 */
function imageUrl(label: "Avatar" | "Banner") {
  return z
    .custom<string | null>(
      (value) => value === null || typeof value === "string",
      { error: `${label} URL must be a string or null` }
    )
    .transform((value, ctx): string | null => {
      if (!value || value.trim() === "") return null;
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsafe URL scheme");
      } catch {
        ctx.issues.push({
          code: "custom",
          message: `Invalid ${label} URL format`,
          input: value,
        });
        return z.NEVER;
      }
      return value.trim();
    })
    .optional();
}

/**
 * The self-update ladder, in its order: name (trimmed, 2 to 50 characters),
 * avatar_url, banner_url, interest_tags, pronouns, year, faculty, visibility,
 * onboarding_completed; last, "No fields to update" when none of them was
 * sent. The output is the handler's payload without `updated_at`: each key
 * only when sent, the name and image URLs trimmed, the rest as sent. Any
 * other key (email, roles, …) is dropped, as the handler never read it.
 */
export const UserUpdateBody = z
  .object({
    name: z
      .custom<string>(
        (value) =>
          typeof value === "string" &&
          value.trim().length >= 2 &&
          value.trim().length <= 50,
        { error: NAME_LENGTH }
      )
      .transform((value) => value.trim())
      .optional(),
    avatar_url: imageUrl("Avatar"),
    banner_url: imageUrl("Banner"),
    interest_tags: interestTags(
      "interest_tags must be an array",
      "Invalid tag values provided in interest_tags"
    ).optional(),
    pronouns: stringOrNull("Pronouns must be a string or null"),
    year: stringOrNull("Year must be a string or null"),
    faculty: stringOrNull("Faculty must be a string or null"),
    visibility: z
      .custom<"public" | "private">(
        (value) => value === "public" || value === "private",
        { error: "Visibility must be 'public' or 'private'" }
      )
      .optional(),
    university_id: z.uuid({ error: "Choose a valid university" }).nullable().optional(),
    other_university: z.string().trim().min(1).max(120).nullable().optional(),
    program: z.string().trim().max(120).nullable().optional(),
    onboarding_completed: z
      .custom<boolean>((value) => typeof value === "boolean", {
        error: "onboarding_completed must be a boolean",
      })
      .optional(),
  })
  .superRefine((body, ctx) => {
    if (body.university_id && body.other_university) ctx.addIssue({ code: "custom", message: "Choose a university or Other, not both" });
    if (Object.keys(body).length === 0) {
      ctx.addIssue({ code: "custom", message: "No fields to update" });
    }
  });

export type UserUpdateBodyInput = z.input<typeof UserUpdateBody>;
export type UserUpdateBodyOutput = z.infer<typeof UserUpdateBody>;

// ─── PUT /api/profile/interests ──────────────────────────────────────────────

export const InterestsBody = z.object({
  interest_tags: interestTags(
    "interest_tags must be an array",
    "Invalid tag values provided"
  ),
});

export type InterestsBodyInput = z.input<typeof InterestsBody>;
export type InterestsBodyOutput = z.infer<typeof InterestsBody>;

// ─── DELETE /api/profile/inferred-tags ───────────────────────────────────────

export const InferredTagBody = z.object({
  tag: z.custom<string>(
    (value) => Boolean(value) && typeof value === "string",
    { error: "tag is required and must be a string" }
  ),
});

export type InferredTagBodyInput = z.input<typeof InferredTagBody>;
export type InferredTagBodyOutput = z.infer<typeof InferredTagBody>;

// ─── POST /api/profile/avatar and /api/profile/banner (multipart) ────────────

/** The routes read no field besides the file. */
export const ProfileImageForm = z.object({});

/**
 * The multipart field both routes read the image from. A client sender types
 * its `formData.append` name as ProfileImageFileField through an `import
 * type`, so renaming the field here fails the sender's type-check without
 * shipping this module (and zod) to the browser (plan 06-11, REFAC-16).
 */
export const PROFILE_IMAGE_FILE_FIELD = "file";
export type ProfileImageFileField = typeof PROFILE_IMAGE_FILE_FIELD;

/**
 * Each route's file rule, texts and order (type before size), and its answer
 * to an unreadable form (M0 CERT-02: malformed transport is a client 400). No guard sits between
 * the form read and the checks, so parseForm runs them.
 */
function profileImageUpload(
  types: readonly string[],
  maxMb: number,
  badType: string
): FormOptions {
  return {
    file: {
      field: PROFILE_IMAGE_FILE_FIELD,
      types,
      maxBytes: maxMb * 1024 * 1024,
      order: ["type", "size"],
      messages: {
        missing: "No file provided",
        tooLarge: `File too large. Maximum size is ${maxMb}MB`,
        badType,
      },
    },
    unreadable: { status: 400, error: "Invalid multipart form data" },
  };
}

export const AVATAR_UPLOAD = profileImageUpload(
  ["image/jpeg", "image/png", "image/webp", "image/gif"],
  5,
  "Invalid file type. Allowed: JPEG, PNG, WebP, GIF"
);

export const PROFILE_BANNER_UPLOAD = profileImageUpload(
  ["image/jpeg", "image/png", "image/webp"],
  8,
  "Invalid file type. Allowed: JPEG, PNG, WebP"
);

// ─── Mutations that read no body (plan 06-11, REFAC-16) ──────────────────────

/** POST and DELETE /api/users/[id]/follow read only the route id. */
export type UserFollowRequestInit = BodilessRequestInit;

/** POST /api/onboarding/complete reads nothing: the caller is the subject. */
export type OnboardingCompleteRequestInit = BodilessRequestInit;

// ─── GET /api/users/saved-events and /api/users/search (no 400) ──────────────

/**
 * sort: `get("sort") || "recent"` (an unknown value falls through to the
 * recent order in the handler, as before); include_past: exactly "true".
 * The time floor on past events is unchanged here (F-085 is 06-18's).
 */
export const SavedEventsQuery = z.object({
  sort: z
    .string()
    .optional()
    .transform((value) => value || "recent"),
  include_past: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

export type SavedEventsQueryOutput = z.infer<typeof SavedEventsQuery>;

/** q, trimmed, or undefined when absent; the handler's "< 2 characters" rule stays. */
export const UserSearchQuery = z.object({
  q: z
    .string()
    .optional()
    .transform((value) => value?.trim()),
});

export type UserSearchQueryOutput = z.infer<typeof UserSearchQuery>;

// ─── Responses the client reads (plan 06-11, REFAC-16, DEC-67) ───────────────
//
// Checked in development only, by the hooks, through checkResponseInDev
// (src/lib/contractCheck.ts); a hook loads these with a dynamic import inside
// a NODE_ENV branch, so they never reach a production client chunk. Every
// object is loose: an extra key is not drift, so a warning means a key the
// client reads has changed.

/**
 * GET /api/my-clubs, 200: each membership with its club (null when the club
 * row is not readable) and three counts.
 */
export const MyClubsResponse = z.looseObject({
  clubs: z.array(
    z.looseObject({
      id: z.string(),
      role: z.string(),
      created_at: z.string(),
      club: z.looseObject({ id: z.string(), name: z.string() }).nullable(),
      memberCount: z.number(),
      followerCount: z.number(),
      upcomingEventCount: z.number(),
    })
  ),
});

export type MyClubsResponseBody = z.infer<typeof MyClubsResponse>;

/**
 * GET /api/user/following, 200: the clubs the caller follows. useFollowedClubIds
 * reads each row's `clubs.id` (null when the joined club is not readable).
 */
export const FollowedClubsResponse = z.looseObject({
  following: z.array(
    z.looseObject({
      id: z.string(),
      created_at: z.string(),
      clubs: z.looseObject({ id: z.string() }).nullable(),
    })
  ),
});

export type FollowedClubsResponseBody = z.infer<typeof FollowedClubsResponse>;

/** POST /api/profile/avatar, 200: the stored public URL. */
export const AvatarUploadResponse = z.looseObject({
  success: z.literal(true),
  avatar_url: z.string(),
});

export type AvatarUploadResponseBody = z.infer<typeof AvatarUploadResponse>;

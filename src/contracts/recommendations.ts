/**
 * Contracts for the recommendations family (plan 06-04, REFAC-15, DEC-65,
 * DEC-68).
 *
 * EVERY MESSAGE IS TODAY'S, IN TODAY'S ORDER. The texts and the order the
 * handlers checked them in are pinned by
 * src/__tests__/api/recommendations/recommendations-family-characterization.test.ts,
 * which passes unedited against these schemas. Keys are declared in check
 * order because zod reports issues in declaration order and parseWith answers
 * the first.
 *
 * QUERY VALUES KEEP TODAY'S SILENT COERCION. top_k is
 * `parseInt(value || "10", 10)` and diversity `value ? parseFloat(value) : 0.7`,
 * so a missing, empty or non-numeric value gives the number the handler used
 * before (NaN included) and never a 400. The handler still clamps diversity
 * and falls back to 0.7 on NaN.
 *
 * NO USER ID IN THE FEEDBACK BODY (DI-44). Neither feedback shape declares
 * `user_id`, so a body naming one parses without it and the handler can only
 * write the authenticated caller's id.
 */
import { z } from "zod";
import type { RecommendationFeedbackAction } from "@/types";

export const RECOMMENDATION_FEEDBACK_ACTIONS = [
  "impression",
  "click",
  "save",
  "dismiss",
] as const satisfies readonly RecommendationFeedbackAction[];

export const THUMBS_FEEDBACK = ["positive", "negative"] as const;
export type ThumbsFeedback = (typeof THUMBS_FEEDBACK)[number];

export const RECOMMENDATION_MESSAGES = {
  badThumbs: "Invalid feedback. Must be 'positive' or 'negative'",
  noEventId: "Missing event_id",
  missing: "Missing required fields: event_id, recommendation_rank, action",
  badAction: `Invalid action. Must be one of: ${RECOMMENDATION_FEEDBACK_ACTIONS.join(", ")}`,
  badRank: "recommendation_rank must be >= 1",
  badPeriod: "Invalid period. Use 7d or 30d",
} as const;

const M = RECOMMENDATION_MESSAGES;

/**
 * A present, non-empty string. Today the handler tested truthiness only, so a
 * numeric id reached the database and failed there (a 500); it is now the
 * same presence 400 (F-094).
 */
function eventId(message: string) {
  return z.custom<string>(
    (value) => typeof value === "string" && value.length > 0,
    { error: message }
  );
}

// ─── GET /api/recommendations ─────────────────────────────────────────────────

export const RecommendationsQuery = z.object({
  top_k: z
    .string()
    .optional()
    .transform((value) => parseInt(value || "10", 10)),
  diversity: z
    .string()
    .optional()
    .transform((value) => (value ? parseFloat(value) : 0.7)),
});

export type RecommendationsQueryInput = z.input<typeof RecommendationsQuery>;
export type RecommendationsQueryOutput = z.infer<typeof RecommendationsQuery>;

// ─── GET /api/recommendations/feedback ────────────────────────────────────────

/** `?event_ids=a,b`: split on commas, trimmed, empties dropped; absent is []. */
export const FeedbackEventIdsQuery = z.object({
  event_ids: z
    .string()
    .optional()
    .transform(
      (value) =>
        value
          ?.split(",")
          .map((id) => id.trim())
          .filter(Boolean) ?? []
    ),
});

export type FeedbackEventIdsQueryOutput = z.infer<typeof FeedbackEventIdsQuery>;

// ─── GET /api/recommendations/analytics ───────────────────────────────────────

/** `period` defaults to 7d when absent or empty; anything but 7d or 30d is a 400. */
export const AnalyticsQuery = z.object({
  period: z
    .string()
    .optional()
    .transform((value) => value || "7d")
    .pipe(z.enum(["7d", "30d"], { error: M.badPeriod })),
});

export type AnalyticsQueryOutput = z.infer<typeof AnalyticsQuery>;

// ─── POST /api/recommendations/feedback ───────────────────────────────────────

/** Thumbs: the feedback value is checked before the event id, as today. */
export const ThumbsFeedbackBody = z
  .object({
    feedback: z.enum(THUMBS_FEEDBACK, { error: M.badThumbs }),
    event_id: eventId(M.noEventId),
  })
  .transform((body) => ({ kind: "thumbs" as const, ...body }));

/**
 * Analytics: all three required fields are checked first (one message), then
 * the action list, then the rank. The rank rule is today's JavaScript
 * comparison `rank < 1`, so a numeric string such as "0" is refused and a
 * value that is not comparable passes through to the database as before.
 * session_id and experiment_variant_id are passed through unvalidated.
 */
export const AnalyticsFeedbackBody = z
  .object({
    event_id: eventId(M.missing),
    recommendation_rank: z.custom<number>((value) => value != null, {
      error: M.missing,
    }),
    action: z.custom<RecommendationFeedbackAction>((value) => !!value, {
      error: M.missing,
    }),
    session_id: z.unknown().optional(),
    experiment_variant_id: z.unknown().optional(),
  })
  .refine(
    (body) =>
      (RECOMMENDATION_FEEDBACK_ACTIONS as readonly unknown[]).includes(
        body.action
      ),
    { error: M.badAction }
  )
  .refine((body) => !((body.recommendation_rank as unknown as number) < 1), {
    error: M.badRank,
  })
  .transform((body) => ({ kind: "analytics" as const, ...body }));

/**
 * The route's body, branched the way the handler branched: a string `feedback`
 * is a thumbs vote; anything else (including a non-string `feedback`) is an
 * analytics event.
 */
export const RecommendationFeedbackBody = z
  .looseObject({}, { error: "Request body must be a JSON object" })
  .transform((body, ctx) => {
    const schema =
      typeof body.feedback === "string"
        ? ThumbsFeedbackBody
        : AnalyticsFeedbackBody;
    const result = schema.safeParse(body);
    if (result.success) return result.data;
    for (const issue of result.error.issues) {
      ctx.issues.push({
        code: "custom",
        message: issue.message,
        path: issue.path,
        input: body,
      });
    }
    return z.NEVER;
  });

export type ThumbsFeedbackBodyInput = z.input<typeof ThumbsFeedbackBody>;
export type AnalyticsFeedbackBodyInput = z.input<typeof AnalyticsFeedbackBody>;
export type ThumbsFeedbackBodyOutput = z.infer<typeof ThumbsFeedbackBody>;
export type AnalyticsFeedbackBodyOutput = z.infer<typeof AnalyticsFeedbackBody>;
export type RecommendationFeedbackBodyInput =
  | ThumbsFeedbackBodyInput
  | AnalyticsFeedbackBodyInput;
export type RecommendationFeedbackBodyOutput = z.infer<
  typeof RecommendationFeedbackBody
>;

// ─── Responses the client reads (plan 06-11, REFAC-16, DEC-67) ───────────────

/**
 * POST /api/recommendations/feedback, 200 on the thumbs arm: `{ ok: true,
 * feedback }`, the vote as stored. Loose (an extra key is not drift); checked
 * in development only by useTracking's submitThumbsFeedback, which loads it
 * with a dynamic import inside a NODE_ENV branch.
 */
export const ThumbsFeedbackResponse = z.looseObject({
  ok: z.literal(true),
  feedback: z.enum(THUMBS_FEEDBACK),
});

export type ThumbsFeedbackResponseBody = z.infer<typeof ThumbsFeedbackResponse>;

/**
 * The POST /api/feedback contract (plan 06-04, REFAC-15, DEC-65).
 *
 * Today's two 400 texts, in today's order, pinned by
 * src/__tests__/api/interactions/interactions-feedback-characterization.test.ts:
 * `Message is required` (absent, not a string, empty or whitespace), then
 * `Invalid feedback type` (checked only when type is truthy, so an empty type
 * is defaulted by the handler). Values are returned as sent: the handler still
 * trims message and subject and defaults the type.
 *
 * subject must be a string when present. Today a non-string subject threw on
 * `.trim()` and answered 500; it is now a 400 with a new text, "Subject must
 * be a string" (F-094, INTENTIONAL BEHAVIOUR CHANGE; no text existed to keep).
 */
import { z } from "zod";
import { NonEmptyTrimmedString } from "@/contracts/common";

export const FEEDBACK_TYPES = ["bug", "feature", "general"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_MESSAGES = {
  message: "Message is required",
  type: "Invalid feedback type",
  subject: "Subject must be a string",
} as const;

const M = FEEDBACK_MESSAGES;

export const FeedbackBody = z.object({
  message: NonEmptyTrimmedString(M.message),
  type: z.custom<FeedbackType | "" | null | undefined>(
    (value) => !value || (FEEDBACK_TYPES as readonly unknown[]).includes(value),
    { error: M.type }
  ).optional(),
  subject: z.custom<string | null | undefined>(
    (value) => value == null || typeof value === "string",
    { error: M.subject }
  ).optional(),
});

export type FeedbackBodyInput = z.input<typeof FeedbackBody>;
export type FeedbackBodyOutput = z.infer<typeof FeedbackBody>;

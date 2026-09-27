/**
 * The POST /api/interactions contract (plan 06-04, REFAC-15, DEC-65).
 *
 * Today's three 400 texts, in today's order, pinned by
 * src/__tests__/api/interactions/interactions-feedback-characterization.test.ts:
 * one presence message for event_id and interaction_type together, then the
 * interaction_type list, then the source list (checked only when source is
 * truthy, so an empty source passes). session_id and metadata pass through
 * unvalidated, as before.
 *
 * event_id must be a non-empty string. Today only its truthiness was checked,
 * so a numeric id reached the database lookup and failed there (a 500); it is
 * now the presence 400 (F-094).
 */
import { z } from "zod";
import type { InteractionSource, TrackInteractionPayload } from "@/types";

export const INTERACTION_TYPES = [
  "view",
  "click",
  "save",
  "unsave",
  "share",
  "calendar_add",
] as const satisfies readonly TrackInteractionPayload["interaction_type"][];

/** Must match the user_interactions.source CHECK constraint. */
export const INTERACTION_SOURCES = [
  "home",
  "search",
  "recommendation",
  "calendar",
  "direct",
  "modal",
  "my-events",
] as const satisfies readonly InteractionSource[];

export const INTERACTION_MESSAGES = {
  required: "event_id and interaction_type are required",
  badType: `Invalid interaction_type. Must be one of: ${INTERACTION_TYPES.join(", ")}`,
  badSource: `Invalid source. Must be one of: ${INTERACTION_SOURCES.join(", ")}`,
} as const;

const M = INTERACTION_MESSAGES;

export const InteractionBody = z.object({
  event_id: z.custom<string>(
    (value) => typeof value === "string" && value.length > 0,
    { error: M.required }
  ),
  interaction_type: z
    .custom<TrackInteractionPayload["interaction_type"]>((value) => !!value, {
      error: M.required,
    })
    .refine(
      (value) => (INTERACTION_TYPES as readonly unknown[]).includes(value),
      { error: M.badType }
    ),
  source: z.custom<InteractionSource | "" | null | undefined>(
    (value) => !value || (INTERACTION_SOURCES as readonly unknown[]).includes(value),
    { error: M.badSource }
  ).optional(),
  session_id: z.unknown().optional(),
  metadata: z.unknown().optional(),
});

export type InteractionBodyInput = z.input<typeof InteractionBody>;
export type InteractionBodyOutput = z.infer<typeof InteractionBody>;

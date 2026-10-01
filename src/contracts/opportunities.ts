import { z } from "zod";
import { DeadlinePrecision, DiscoveryIdentity, Instant, ListingType, RelevanceScope, SafeHttpUrl, SourceTimezone, UUID, WorkMode } from "./discovery";

const text = (max: number) => z.string().trim().min(1).max(max);
const nullableText = (max: number) => text(max).nullable();
export const EditorialMetadata = z.object({
  relevance_scope: RelevanceScope.default("unknown"), university_ids: z.array(UUID).max(20).default([]),
  organizer_university_id: UUID.nullable().default(null), eligibility_text: nullableText(2000).default(null),
  fields: z.array(text(60)).max(12).default([]),
  deadline_precision: DeadlinePrecision.default("none"), deadline_at: Instant.nullable().default(null),
  deadline_date: z.iso.date().nullable().default(null), source_timezone: SourceTimezone.default("America/Toronto"),
  timezone_assumed: z.boolean().default(true), checked_at: Instant.nullable().default(null), review_at: Instant.nullable().default(null),
  curator_note: nullableText(2000).default(null), is_pick: z.boolean().default(false), pick_reason: nullableText(500).default(null),
  editorial_priority: z.number().int().min(0).max(100).default(0),
});

export const OpportunityFields = EditorialMetadata.extend({
  slug: text(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), listing_type: ListingType,
  subtype: nullableText(80).default(null), title: text(200), description: text(15000), organization: text(200),
  location: z.string().trim().max(200).default(""), work_mode: WorkMode.default("in_person"),
  source_type: z.enum(["manual", "indexed", "partner"]).default("manual"), source_url: SafeHttpUrl.nullable().default(null),
  application_mode: z.enum(["external", "none"]).default("external"), action_url: SafeHttpUrl.nullable().default(null),
  action_note: nullableText(1000).default(null), starts_at: Instant.nullable().default(null), ends_at: Instant.nullable().default(null),
  duplicate_review_note: nullableText(2000).default(null),
}).strict();

function temporalRules(value: z.output<typeof EditorialMetadata> & { starts_at?: string | null; ends_at?: string | null }, ctx: z.RefinementCtx) {
  if (value.deadline_precision === "date" ? !value.deadline_date || value.deadline_at !== null
    : value.deadline_precision === "datetime" ? !value.deadline_at || value.deadline_date !== null
      : value.deadline_at !== null || value.deadline_date !== null) {
    ctx.addIssue({ code: "custom", message: "Deadline value must match its precision", path: ["deadline_precision"] });
  }
  if (value.starts_at && value.ends_at && Date.parse(value.ends_at) <= Date.parse(value.starts_at)) {
    ctx.addIssue({ code: "custom", message: "End must follow start", path: ["ends_at"] });
  }
  if (value.is_pick && !value.pick_reason) ctx.addIssue({ code: "custom", message: "A Pick needs an explanation", path: ["pick_reason"] });
  if (value.relevance_scope === "specific" && !value.university_ids.length) ctx.addIssue({ code: "custom", message: "Specific relevance needs a university", path: ["university_ids"] });
  if (value.relevance_scope !== "specific" && value.university_ids.length) ctx.addIssue({ code: "custom", message: "University relevance must be specific when universities are listed", path: ["university_ids"] });
}
export const OpportunityCreateBody = OpportunityFields.superRefine(temporalRules);
export type OpportunityInput = z.input<typeof OpportunityCreateBody>;
export type OpportunityData = z.output<typeof OpportunityCreateBody>;
export const OpportunityMutationBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), expected_updated_at: Instant, data: OpportunityCreateBody }).strict(),
  z.object({ action: z.enum(["publish", "archive"]), expected_updated_at: Instant }).strict(),
  z.object({ action: z.literal("merge"), expected_updated_at: Instant, canonical: DiscoveryIdentity, reason: text(2000) }).strict(),
]);
export const EventEditorialMetadata = EditorialMetadata.extend({ listing_type: z.enum(["event", "hackathon", "networking"]).default("event"), duplicate_review_note: nullableText(2000).default(null) });
export const EventMetadataBody = z.object({
  expected_updated_at: Instant.nullable(), data: EventEditorialMetadata.superRefine(temporalRules),
}).strict();
export const OpportunityAdminQuery = z.object({ status: z.enum(["draft", "published", "archived"]).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });
export type OpportunityMutationInput = z.input<typeof OpportunityMutationBody>;
export type EventMetadataInput = z.input<typeof EventMetadataBody>;
export type OpportunityAdminRecord = OpportunityData & { id: string; status: "draft" | "published" | "archived"; updated_at: string; created_at: string; published_at: string | null; created_by: string; canonical_event_id: string | null; canonical_opportunity_id: string | null };

export const EventMergeBody = z.object({ expected_updated_at: Instant.nullable(), canonical: DiscoveryIdentity, reason: text(2000) }).strict();

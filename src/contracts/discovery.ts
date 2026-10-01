import { z } from "zod";

export const ListingType = z.enum(["event", "hackathon", "job", "program", "networking", "grant"]);
export const ListingKind = z.enum(["event", "opportunity"]);
export const WorkMode = z.enum(["in_person", "remote", "hybrid"]);
export const RelevanceScope = z.enum(["cross_campus", "specific", "unknown"]);
export const DeadlinePrecision = z.enum(["none", "date", "datetime"]);
export const UUID = z.uuid();
export const SafeHttpUrl = z.url().max(2048).refine((value) => /^https?:\/\//i.test(value), "URL must use http or https");
export const Instant = z.iso.datetime({ offset: true });
export const SourceTimezone = z.string().max(80).refine((value) => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}, "Invalid source timezone");

export const DiscoveryQuery = z.object({
  type: ListingType.optional(), university: UUID.optional(), field: z.string().trim().min(1).max(60).optional(),
  work_mode: WorkMode.optional(), q: z.string().trim().max(120).default(""),
  window: z.enum(["upcoming", "this_week"]).default("upcoming"),
  limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().max(2048).optional(),
});
export type DiscoveryQueryInput = z.input<typeof DiscoveryQuery>;
export type DiscoveryFilters = z.output<typeof DiscoveryQuery>;
export const DiscoveryIdentity = z.object({ kind: ListingKind, id: UUID });
export const DetailParams = z.object({ id: UUID });
export const SavedQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().max(2048).optional() });

/** Explicit public projection. Never add viewer state or private intake data. */
export type DiscoveryItem = {
  kind: "event" | "opportunity"; id: string; slug: string | null; title: string; description: string;
  listing_type: z.infer<typeof ListingType>; subtype: string | null; organization: string;
  organizer_university_id: string | null; location: string; work_mode: z.infer<typeof WorkMode>; fields: string[];
  relevance_scope: z.infer<typeof RelevanceScope>; university_ids: string[]; eligibility_text: string | null;
  source_type: "manual" | "indexed" | "partner"; source_url: string | null;
  action_url: string | null; application_mode: "external" | "universe" | "none"; action_note: string | null;
  starts_at: string | null; ends_at: string | null; deadline_at: string | null; deadline_date: string | null;
  deadline_precision: z.infer<typeof DeadlinePrecision>; source_timezone: string; timezone_assumed: boolean;
  review_at: string | null; checked_at: string | null; published_at: string;
  curator_note: string | null; pick_reason: string | null; is_pick: boolean; editorial_priority: number;
  actionable_at: string | null; expires_at: string | null; closed: boolean;
  canonical_kind: "event" | "opportunity" | null; canonical_id: string | null;
};
export type DiscoveryPage = { items: DiscoveryItem[]; next_cursor: string | null; as_of: string };
export type SavedDiscoveryItem = DiscoveryItem & { saved_at: string };
export type SavedDiscoveryPage = { items: SavedDiscoveryItem[]; next_cursor: string | null; as_of: string };

export const SavedStatusQuery = z.object({ identities: z.string().max(2500).transform((value) => value.split(",")).pipe(z.array(z.string().regex(/^(event|opportunity):[0-9a-f-]{36}$/i)).min(1).max(50)).transform((values) => values.map((value) => { const [kind, id] = value.split(":"); return { kind, id }; })).pipe(z.array(DiscoveryIdentity)) });

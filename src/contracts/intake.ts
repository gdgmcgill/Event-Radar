import { z } from "zod";
import { findUnsafeMarkdown } from "@/lib/markdown/parse";
import { Instant, SafeHttpUrl, UUID, WorkMode } from "./discovery";
import { ResourceCategory } from "./resources";

/** M3 P1-09 public intake. Every public body is strict: an unknown key such
 * as `status`, `is_pick` or `checked_at` is a 400, and no body field can set
 * review or editorial state (the RPCs have no such parameter either). */

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const IsoDate = z.iso.date();
const ContactEmail = z.email().max(254);
const SafeHttpsUrl = SafeHttpUrl.refine((value) => /^https:\/\//i.test(value), "URL must use https");

/** Free text that becomes listing copy. The length cap is checked inside the
 * refinement FIRST, so an oversized value never reaches the Markdown scanner
 * (whose worst case grows with input length). */
function plainText(max: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(max)
    .superRefine((value, ctx) => {
      if (value.length > max) return;
      const reason = findUnsafeMarkdown(value);
      if (reason) ctx.addIssue({ code: "custom", message: reason });
    });
}

/** The honeypot. Humans never see or fill it; a non-empty value is silently
 * accepted with no database call. */
export const Honeypot = z.string().max(200).optional();

const common = {
  title: text(200),
  organization: text(200),
  source_url: SafeHttpUrl,
  description: plainText(2000),
  contact_name: optionalText(120),
  contact_email: ContactEmail.optional(),
  website: Honeypot,
};
const dated = { starts_on: IsoDate.optional(), location: optionalText(200) };
const role = { deadline_on: IsoDate.optional(), location: optionalText(200), work_mode: WorkMode.optional() };

/** Stored `details` must stay under the database's jsonb size check (16 KB).
 * Contracts cap characters; this caps the serialized details in UTF-8 bytes,
 * so a multibyte payload fails as a 400 instead of a database violation. */
export const DETAILS_MAX_BYTES = 12000;
function detailsWithinBudget(value: SubmissionData | CompanyRequestData, ctx: z.RefinementCtx) {
  if (new TextEncoder().encode(JSON.stringify(toIntakeDetails(value))).length > DETAILS_MAX_BYTES) {
    ctx.addIssue({ code: "custom", message: "Submission is too long." });
  }
}

export const SubmissionKind = z.enum(["event", "hackathon", "job", "program", "resource"]);
export const SubmissionBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("event"), ...common, ...dated }).strict(),
  z.object({ kind: z.literal("hackathon"), ...common, ...dated }).strict(),
  z.object({ kind: z.literal("job"), ...common, ...role }).strict(),
  z.object({ kind: z.literal("program"), ...common, ...role }).strict(),
  z
    .object({
      kind: z.literal("resource"),
      ...common,
      // A suggested resource converts to an external resource, which the
      // resources table only accepts with an https link.
      source_url: SafeHttpsUrl,
      category: ResourceCategory.optional(),
      audience: optionalText(200),
    })
    .strict(),
]).superRefine(detailsWithinBudget);
export type SubmissionInput = z.input<typeof SubmissionBody>;
export type SubmissionData = z.output<typeof SubmissionBody>;
/** Top-level keys a validation 400 names as `field`, so a form can mark the
 * matching input. */
export const SUBMISSION_FIELDS = [
  "title",
  "organization",
  "source_url",
  "description",
  "starts_on",
  "deadline_on",
  "location",
  "work_mode",
  "category",
  "audience",
  "contact_name",
  "contact_email",
] as const;

export const EmploymentType = z.enum(["internship", "part_time", "full_time", "contract"]);
export const CompanyRequestBody = z
  .object({
    company_name: text(200),
    company_context: plainText(1000),
    role_title: text(200),
    duties: plainText(3000),
    must_have_skills: plainText(1000),
    nice_to_have_skills: z.string().trim().max(1000).superRefine((value, ctx) => {
      if (value.length > 1000) return;
      const reason = findUnsafeMarkdown(value);
      if (reason) ctx.addIssue({ code: "custom", message: reason });
    }).optional(),
    hours: text(120),
    compensation: text(200),
    location: text(200),
    work_mode: WorkMode,
    start_date: text(60),
    employment_type: EmploymentType,
    why_worth_it: plainText(1000),
    source_url: SafeHttpUrl.optional(),
    contact_name: text(120),
    contact_email: ContactEmail,
    website: Honeypot,
  })
  .strict()
  .superRefine(detailsWithinBudget);
export type CompanyRequestInput = z.input<typeof CompanyRequestBody>;
export type CompanyRequestData = z.output<typeof CompanyRequestBody>;
export const COMPANY_REQUEST_FIELDS = [
  "company_name",
  "company_context",
  "role_title",
  "duties",
  "must_have_skills",
  "nice_to_have_skills",
  "hours",
  "compensation",
  "location",
  "work_mode",
  "start_date",
  "employment_type",
  "why_worth_it",
  "source_url",
  "contact_name",
  "contact_email",
] as const;

export const ReportKind = z.enum(["event", "opportunity", "resource"]);
export const ReportReason = z.enum(["wrong_date", "dead_link", "scam", "duplicate", "other"]);
export const ListingReportBody = z
  .object({
    kind: ReportKind,
    id: UUID,
    reason: ReportReason,
    details: optionalText(1000),
    website: Honeypot,
  })
  .strict();
export type ListingReportInput = z.input<typeof ListingReportBody>;

/** Keys that are columns of their own (or private, or the honeypot) and
 * therefore never enter the `details` object. */
const NOT_DETAILS = new Set([
  "kind",
  "title",
  "organization",
  "source_url",
  "contact_name",
  "contact_email",
  "website",
  "company_name",
  "role_title",
]);

/** The per-kind extra fields, trimmed, omitting empties. Never contains the
 * private contact fields. */
export function toIntakeDetails(body: SubmissionData | CompanyRequestData): Record<string, string> {
  const details: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (NOT_DETAILS.has(key) || typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) details[key] = trimmed;
  }
  return details;
}

// ─── Admin review ─────────────────────────────────────────────────────────────

export const SubmissionStatus = z.enum(["pending", "converted", "rejected", "spam"]);
export const SubmissionAdminQuery = z.object({
  status: SubmissionStatus.default("pending"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const SubmissionReviewBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("convert"), expected_updated_at: Instant }).strict(),
  z.object({ action: z.literal("reject"), expected_updated_at: Instant, reason: text(1000) }).strict(),
  z.object({ action: z.literal("spam"), expected_updated_at: Instant, reason: optionalText(1000) }).strict(),
]);
export type SubmissionReviewInput = z.input<typeof SubmissionReviewBody>;

export const ListingReportStatus = z.enum(["open", "resolved", "dismissed"]);
export const ListingReportAdminQuery = z.object({
  status: ListingReportStatus.default("open"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const ListingReportResolveBody = z
  .object({ action: z.enum(["resolve", "dismiss"]), note: optionalText(1000) })
  .strict();
export type ListingReportResolveInput = z.input<typeof ListingReportResolveBody>;

/** Admin-only record: includes the private contact fields. Never returned by
 * a public route. */
export type SubmissionAdminRecord = {
  id: string;
  kind: z.infer<typeof SubmissionKind> | "company_request";
  title: string;
  organization: string;
  source_url: string | null;
  details: Record<string, string>;
  contact_name: string | null;
  contact_email: string | null;
  status: z.infer<typeof SubmissionStatus>;
  review_reason: string | null;
  reviewed_at: string | null;
  target_opportunity_id: string | null;
  target_resource_id: string | null;
  created_at: string;
  updated_at: string;
};
export type SubmissionReviewResult = {
  submission: Omit<SubmissionAdminRecord, "contact_name" | "contact_email">;
  target: { kind: "opportunity" | "resource"; id: string } | null;
};

export type ListingReportAdminRecord = {
  id: string;
  kind: z.infer<typeof ReportKind>;
  target_id: string;
  target_title: string | null;
  reason: z.infer<typeof ReportReason>;
  details: string | null;
  status: z.infer<typeof ListingReportStatus>;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
};

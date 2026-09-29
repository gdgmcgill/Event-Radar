import { z } from "zod";
import { findUnsafeMarkdown } from "@/lib/markdown/parse";
import type { FormOptions } from "@/server/body";

export const ResourceType = z.enum(["guide", "external", "template"]);
export const ResourceCategory = z.enum(["career", "applications", "hackathons", "academics", "funding", "campus_life"]);
export type ResourceCategoryValue = z.infer<typeof ResourceCategory>;
export const RESOURCE_CATEGORY_LABELS: Record<z.infer<typeof ResourceCategory>, string> = {
  career: "Career",
  applications: "Applications",
  hackathons: "Hackathons",
  academics: "Academics",
  funding: "Funding",
  campus_life: "Campus life",
};

const text = (max: number) => z.string().trim().min(1).max(max);
const nullableText = (max: number) => text(max).nullable();
const SafeHttpsUrl = z.url().max(2048).refine((value) => /^https:\/\//i.test(value), "URL must use https");

export const SafeMarkdownBody = z
  .string()
  .max(50000)
  .superRefine((value, ctx) => {
    const reason = findUnsafeMarkdown(value);
    if (reason) ctx.addIssue({ code: "custom", message: reason });
  });

/**
 * The base shape carries NO defaults on its nullable fields. Fix round 1,
 * IMPORTANT: `.partial()` in zod 4 still applies a field's `.default()` when
 * that field is absent from the input (partial makes a key optional, not
 * default-free), so `ResourceFields.partial()` would silently turn `{title:
 * "x"}` into `{title:"x", body_markdown:null, external_url:null,
 * author_url:null, source_note:null}` — and the RPC's `p_data ? 'key'`
 * presence check would then null out every field the caller never touched.
 * `ResourceFields` (this shape) is what `.partial()` uses for an edit, so an
 * untouched field is simply ABSENT from its output. `ResourceCreateBody`
 * layers the create-only null defaults back on for a full create/replace
 * submission, where every field is expected to be present one way or another.
 */
export const ResourceFields = z
  .object({
    slug: text(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    resource_type: ResourceType,
    title: text(200),
    summary: text(500),
    body_markdown: SafeMarkdownBody.nullable(),
    external_url: SafeHttpsUrl.nullable(),
    category: ResourceCategory,
    audience: text(200),
    author_name: text(120),
    author_url: SafeHttpsUrl.nullable(),
    source_note: nullableText(500),
  })
  .strict();

const ResourceFieldsWithCreateDefaults = ResourceFields.extend({
  body_markdown: SafeMarkdownBody.nullable().default(null),
  external_url: SafeHttpsUrl.nullable().default(null),
  author_url: SafeHttpsUrl.nullable().default(null),
  source_note: nullableText(500).default(null),
}).strict();

function shapeRules(value: z.output<typeof ResourceFieldsWithCreateDefaults>, ctx: z.RefinementCtx) {
  if (value.resource_type === "guide") {
    if (!value.body_markdown || !value.body_markdown.trim()) {
      ctx.addIssue({ code: "custom", message: "A guide needs body text", path: ["body_markdown"] });
    }
    if (value.external_url) {
      ctx.addIssue({ code: "custom", message: "A guide cannot have an external URL", path: ["external_url"] });
    }
  } else if (value.resource_type === "external") {
    if (!value.external_url) {
      ctx.addIssue({ code: "custom", message: "An external resource needs a source URL", path: ["external_url"] });
    }
  } else if (value.resource_type === "template") {
    if (value.external_url) {
      ctx.addIssue({ code: "custom", message: "A template cannot have an external URL", path: ["external_url"] });
    }
  }
}

export const ResourceCreateBody = ResourceFieldsWithCreateDefaults.superRefine(shapeRules);
export type ResourceInput = z.input<typeof ResourceCreateBody>;
export type ResourceData = z.output<typeof ResourceCreateBody>;

export const ResourceMutationBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), expected_updated_at: z.iso.datetime({ offset: true }), data: ResourceFields.partial() }).strict(),
  z.object({ action: z.enum(["publish", "archive"]), expected_updated_at: z.iso.datetime({ offset: true }) }).strict(),
]);
export type ResourceMutationInput = z.input<typeof ResourceMutationBody>;

export const ResourceSlugParams = z.object({ slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) });
export const ResourceListQuery = z.object({
  category: ResourceCategory.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});
export const ResourceAdminQuery = z.object({
  status: z.enum(["draft", "published", "archived"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const ResourceFileUploadFields = z.object({ expected_updated_at: z.iso.datetime({ offset: true }) }).strict();

/** The file rule, texts and content types for a resource-file upload: exactly
 * the four extensions the storage bucket and the resources table's
 * file_path constraint allow. M0 CERT-02 classifies malformed multipart
 * transport as 400 before any upload or storage operation. */
export const RESOURCE_FILE_UPLOAD: FormOptions = {
  file: {
    field: "file",
    types: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    maxBytes: 10 * 1024 * 1024,
    messages: {
      missing: "A file is required",
      tooLarge: "File too large. Maximum size is 10MB",
      badType: (type: string) => `Invalid file type "${type}". Allowed: PDF, DOCX, XLSX, PPTX.`,
    },
  },
  unreadable: { status: 400, error: "Invalid multipart form data" },
  // body.ts's automatic post-parse content sniff only recognizes image
  // signatures; the route runs its own PDF/OOXML sniff instead.
  deferFileChecks: true,
};

export type PublicResource = {
  id: string;
  slug: string;
  resource_type: z.infer<typeof ResourceType>;
  title: string;
  summary: string;
  body_markdown: string | null;
  external_url: string | null;
  file_name: string | null;
  file_size: number | null;
  category: z.infer<typeof ResourceCategory>;
  audience: string;
  author_name: string;
  author_url: string | null;
  source_note: string | null;
  reviewed_at: string | null;
  published_at: string | null;
};

export type ResourceAdminRecord = ResourceData & {
  id: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  status: "draft" | "published" | "archived";
  reviewed_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
};

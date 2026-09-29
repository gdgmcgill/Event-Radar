import type { RequestContext } from "@/server/context";
import type { PublicResource, ResourceCategoryValue } from "@/contracts/resources";
import { getElevatedClient } from "@/server/db/elevated";
import { log } from "@/server/log";

export const PUBLIC_RESOURCE_COLUMNS =
  "id,slug,resource_type,title,summary,body_markdown,external_url,file_name,file_size,category,audience,author_name,author_url,source_note,reviewed_at,published_at";

export async function listResources(
  ctx: RequestContext,
  q: { category?: ResourceCategoryValue; limit: number }
): Promise<PublicResource[]> {
  let query = ctx.supabase
    .from("resources")
    .select(PUBLIC_RESOURCE_COLUMNS)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("reviewed_at", { ascending: false })
    .order("id")
    .limit(q.limit);
  if (q.category) query = query.eq("category", q.category);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as PublicResource[];
}

export async function resourceBySlug(ctx: RequestContext, slug: string): Promise<PublicResource | null> {
  const { data, error } = await ctx.supabase
    .from("resources")
    .select(PUBLIC_RESOURCE_COLUMNS)
    .eq("status", "published")
    .is("deleted_at", null)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PublicResource | null) ?? null;
}

/** The published row's `open` target. `guide` has no external target (its body
 * renders in place). `external` redirects to its source URL. `template` reads
 * the private `file_path` through the elevated door (never publicly granted)
 * and issues a short-lived signed download URL. A failed action-log insert is
 * logged and never blocks the redirect — recording a click is best-effort. */
export async function resourceOpenTarget(
  ctx: RequestContext,
  slug: string
): Promise<{ action: "outbound" | "download"; url: string } | null> {
  const { data, error } = await ctx.supabase
    .from("resources")
    .select("id,resource_type,external_url")
    .eq("status", "published")
    .is("deleted_at", null)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.resource_type === "guide") return null;
  const db = getElevatedClient();
  if (data.resource_type === "external") {
    if (!data.external_url) return null;
    const { error: actionError } = await db.from("resource_actions").insert({ resource_id: data.id, action: "outbound" });
    if (actionError) log.error("Failed to record resource action", { error: actionError, scope: "resources", resourceId: data.id });
    return { action: "outbound", url: data.external_url };
  }
  const { data: privateRow, error: privateError } = await db
    .from("resources")
    .select("file_path,file_name")
    .eq("id", data.id)
    .maybeSingle();
  if (privateError) throw privateError;
  if (!privateRow?.file_path) return null;
  const { data: signed, error: signError } = await db.storage
    .from("resource-files")
    .createSignedUrl(privateRow.file_path, 60, { download: privateRow.file_name ?? undefined });
  if (signError || !signed) throw signError ?? new Error("Failed to sign resource file URL");
  const { error: actionError } = await db.from("resource_actions").insert({ resource_id: data.id, action: "download" });
  if (actionError) log.error("Failed to record resource action", { error: actionError, scope: "resources", resourceId: data.id });
  return { action: "download", url: signed.signedUrl };
}

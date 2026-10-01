import type { RequestContext } from "@/server/context";
import type { DiscoveryFilters, DiscoveryItem, DiscoveryPage, SavedDiscoveryItem, SavedDiscoveryPage } from "@/contracts/discovery";
import { decodeCursor, discoveryFilterHash, encodeCursor, savedFilterHash } from "./cursor";
export async function discover(ctx: RequestContext, filters: DiscoveryFilters): Promise<DiscoveryPage> {
  const hash = discoveryFilterHash(filters);
  const { as_of, after } = decodeCursor(filters.cursor, hash);
  const { cursor: _cursor, limit, ...dbFilters } = filters;
  const { data, error } = await ctx.supabase.rpc("query_discovery", { p_as_of: as_of, p_filters: dbFilters, p_after: after, p_limit: limit + 1 });
  if (error) throw error;
  const rows = (data ?? []) as unknown as DiscoveryItem[];
  const items = rows.slice(0, limit);
  return { items, as_of, next_cursor: rows.length > limit ? encodeCursor(items[items.length - 1], as_of, hash) : null };
}
export async function savedDiscovery(ctx: RequestContext, filters: { limit: number; cursor?: string }): Promise<SavedDiscoveryPage> {
  const hash = savedFilterHash(ctx.user!.id);
  const { as_of, after } = decodeCursor(filters.cursor, hash, true);
  const { data, error } = await ctx.supabase.rpc("query_saved_discovery", { p_as_of: as_of, p_after: after, p_limit: filters.limit + 1 });
  if (error) throw error;
  const rows = (data ?? []) as unknown as SavedDiscoveryItem[];
  const items = rows.slice(0, filters.limit);
  return { items, as_of, next_cursor: rows.length > filters.limit ? encodeCursor(items[items.length - 1], as_of, hash) : null };
}
export async function publicDetail(ctx: RequestContext, kind: "event" | "opportunity", id: string): Promise<DiscoveryItem | null> {
  const { data, error } = await ctx.supabase.from("discovery_public").select("*").eq("kind", kind).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.canonical_id && data.canonical_kind) {
    const { data: target, error: targetError } = await ctx.supabase.from("discovery_public").select("id").eq("kind", data.canonical_kind).eq("id", data.canonical_id).maybeSingle();
    if (targetError) throw targetError;
    if (!target) return null;
  }
  return { ...data, closed: !data.expires_at || Date.parse(data.expires_at) <= Date.now() } as DiscoveryItem;
}

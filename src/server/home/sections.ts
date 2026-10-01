import "server-only";
import type { RequestContext } from "@/server/context";
import type { DiscoveryItem } from "@/contracts/discovery";
import type { PublicResource } from "@/contracts/resources";
import { discover } from "@/server/discovery/service";
import { listResources } from "@/server/resources/service";
import { log } from "@/server/log";

/** A homepage section is computed independently from the others: one
 * section's failure never blocks or fakes another's. */
export type Section<T> = { status: "ok"; items: T[] } | { status: "error" };

export type HomeSections = {
  thisWeek: Section<DiscoveryItem>;
  picks: Section<DiscoveryItem>;
  resources: Section<PublicResource>;
};

type SectionName = "thisWeek" | "picks" | "resources";

async function safeSection<T>(
  section: SectionName,
  run: () => Promise<T[]>
): Promise<Section<T>> {
  try {
    return { status: "ok", items: await run() };
  } catch {
    log.error("home section failed", { section });
    return { status: "error" };
  }
}

/** Editorial picks: cookie-client read of `discovery_public`, never the
 * elevated door — this is a public projection, same as `discover()`. */
async function fetchPicks(ctx: RequestContext): Promise<DiscoveryItem[]> {
  const now = new Date().toISOString();
  const { data, error } = await ctx.supabase
    .from("discovery_public")
    .select("*")
    .eq("is_pick", true)
    .is("canonical_id", null)
    .lte("published_at", now)
    .gt("expires_at", now)
    .order("editorial_priority", { ascending: false })
    .order("actionable_at", { ascending: true })
    .limit(4);
  if (error) throw error;
  return ((data ?? []) as unknown as DiscoveryItem[]).map((item) => ({
    ...item,
    closed: false,
  }));
}

export async function homeSections(ctx: RequestContext): Promise<HomeSections> {
  const [thisWeek, picks, resources] = await Promise.all([
    safeSection("thisWeek", async () => {
      const page = await discover(ctx, { q: "", window: "this_week", limit: 6 });
      return page.items;
    }),
    safeSection("picks", () => fetchPicks(ctx)),
    safeSection("resources", () => listResources(ctx, { limit: 3 })),
  ]);
  return { thisWeek, picks, resources };
}

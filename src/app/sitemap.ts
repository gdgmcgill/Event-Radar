import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { getFeatureFlags } from "@/lib/features";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://universeapp.ca";
  const discoveryEnabled = getFeatureFlags().discovery_ui;

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/clubs`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    // `/landing` stays out of the sitemap once `/` is the editorial
    // homepage — it now redirects there and has nothing of its own to index.
    ...(discoveryEnabled
      ? []
      : [
          {
            url: `${baseUrl}/landing`,
            lastModified: new Date(),
            changeFrequency: "monthly" as const,
            priority: 0.7,
          },
        ]),
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...(discoveryEnabled
      ? [
          {
            url: `${baseUrl}/discover`,
            lastModified: new Date(),
            changeFrequency: "daily" as const,
            priority: 0.9,
          },
          {
            url: `${baseUrl}/resources`,
            lastModified: new Date(),
            changeFrequency: "weekly" as const,
            priority: 0.6,
          },
          {
            url: `${baseUrl}/submit`,
            lastModified: new Date(),
            changeFrequency: "monthly" as const,
            priority: 0.4,
          },
          {
            url: `${baseUrl}/for-companies`,
            lastModified: new Date(),
            changeFrequency: "monthly" as const,
            priority: 0.4,
          },
        ]
      : []),
  ];

  try {
    const supabase = await createClient();
    const { data: events } = await supabase
      .from("events")
      .select("id, updated_at")
      .eq("status", "approved")
      .order("updated_at", { ascending: false })
      .limit(500);

    const eventPages: MetadataRoute.Sitemap = (events ?? []).map((event) => ({
      url: `${baseUrl}/events/${event.id}`,
      lastModified: new Date(event.updated_at ?? Date.now()),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    if (!discoveryEnabled) return [...staticPages, ...eventPages];

    // `discovery_public` has no `updated_at` column (deviation from the
    // brief, which named that column); `published_at` is the closest
    // freshness signal the public projection actually carries.
    const { data: opportunities } = await supabase
      .from("discovery_public")
      .select("id, published_at")
      .eq("kind", "opportunity")
      .is("canonical_id", null)
      .limit(500);

    const opportunityPages: MetadataRoute.Sitemap = (opportunities ?? [])
      .filter((row): row is { id: string; published_at: string | null } => !!row.id)
      .map((row) => ({
        url: `${baseUrl}/opportunities/${row.id}`,
        lastModified: new Date(row.published_at ?? Date.now()),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));

    const { data: resources } = await supabase
      .from("resources")
      .select("slug, reviewed_at")
      .eq("status", "published")
      .is("deleted_at", null)
      .limit(500);

    const resourcePages: MetadataRoute.Sitemap = (resources ?? []).map((row) => ({
      url: `${baseUrl}/resources/${row.slug}`,
      lastModified: new Date(row.reviewed_at ?? Date.now()),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));

    return [...staticPages, ...eventPages, ...opportunityPages, ...resourcePages];
  } catch {
    return staticPages;
  }
}

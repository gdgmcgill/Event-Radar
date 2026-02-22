import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://uni-verse.vercel.app";

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/calendar`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  // Fetch approved events for dynamic pages
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
      lastModified: new Date(event.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    return [...staticPages, ...eventPages];
  } catch {
    return staticPages;
  }
}

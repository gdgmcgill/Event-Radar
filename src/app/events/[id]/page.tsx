/**
 * Event detail page (server component)
 * Provides dynamic SEO metadata via generateMetadata and renders the client component
 */

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import EventDetailClient from "./EventDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("title, description, image_url")
    .eq("id", id)
    .single();

  if (!event) {
    return { title: "Event Not Found" };
  }

  const description =
    event.description.length > 160
      ? event.description.slice(0, 157) + "..."
      : event.description;

  return {
    title: event.title,
    description,
    openGraph: {
      title: event.title,
      description,
      type: "article",
      ...(event.image_url && {
        images: [{ url: event.image_url, width: 1200, height: 630 }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      ...(event.image_url && { images: [event.image_url] }),
    },
  };
}

export default function EventDetailPage() {
  return <EventDetailClient />;
}

/**
 * Event detail page (server component)
 * Provides dynamic SEO metadata via generateMetadata and renders the client component
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import EventDetailClient from "./EventDetailClient";
import { permanentRedirect } from "next/navigation";
import { discoverySurface } from "@/server/discoveryAccess";
import { getRequestContext } from "@/server/context";
import { publicDetail } from "@/server/discovery/service";
import { UUID, type DiscoveryItem } from "@/contracts/discovery";

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

  const description = event.description
    ? event.description.length > 160
      ? event.description.slice(0, 157) + "..."
      : event.description
    : undefined;

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

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let discovery: DiscoveryItem | null = null;
  if ((await discoverySurface()).enabled && UUID.safeParse(id).success) {
    const item = await publicDetail(await getRequestContext(), "event", id);
    if (item?.canonical_id && item.canonical_kind) permanentRedirect(`/${item.canonical_kind === "event" ? "events" : "opportunities"}/${item.canonical_id}`);
    discovery = item;
  }
  return (
    <Suspense>
      <EventDetailClient discovery={discovery} />
    </Suspense>
  );
}

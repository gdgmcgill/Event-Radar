"use client";

/**
 * Home page - Main event calendar/browse view
 * TODO: Implement event fetching, filtering, search, and calendar view
 */

import { EventSearch } from "@/components/events/EventSearch";
import { EventFilters } from "@/components/events/EventFilters";
import { EventGrid } from "@/components/events/EventGrid";
import { Suspense } from "react";
import { EventCard } from "@/components/events/EventCard";
import { EventCardSkeleton } from "@/components/events/EventCardSkeleton";
import { EventTag } from "@/types";
import { type Event } from "@/types";

const event: Event = {
  id: "1",
  title: "Sample Event",
  description: "This is a sample event description.",
  event_date: "2024-06-01",
  event_time: "18:00",
  location: "Sample Location",
  image_url: "",
  tags: [EventTag.ACADEMIC],
  club: {
    id: "1",
    name: "Sample Club",
    instagram_handle: "sampleclub",
    logo_url: "",
    description: "This is a sample club description.",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  club_id: "",
  created_at: "",
  updated_at: "",
  status: "pending",
  approved_by: null,
  approved_at: null
};

export default function HomePage() {
  // TODO: Implement state management for filters and search
  // TODO: Use useEvents hook to fetch events
  // TODO: Add calendar view toggle

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Discover Campus Events</h1>
        <p className="text-muted-foreground">
          Explore events happening at McGill University
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <EventSearch />
          </div>
          {/* TODO: Add view toggle (grid/calendar) */}
        </div>
        <EventFilters />
      </div>

      {/* Events Grid */}
      <Suspense fallback={<div>Loading events...</div>}>
      <EventCardSkeleton />
      <EventCard event={event}/>
        {/* TODO: Replace with actual event data */}
        <EventGrid events={[]} loading={false} />
      </Suspense>
    </div>
  );
}


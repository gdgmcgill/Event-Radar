"use client";

/**
 * Home page - Main event calendar/browse view
 * TODO: Implement event fetching, filtering, search, and calendar view
 */

import { EventSearch } from "@/components/events/EventSearch";
import { EventFilters } from "@/components/events/EventFilters";
import { EventGrid } from "@/components/events/EventGrid";
import { useEvents } from "@/hooks/useEvents";
import { Suspense } from "react";

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
        {/* TODO: Replace with actual event data */}
        <EventGrid events={[]} loading={false} />
      </Suspense>
    </div>
  );
}


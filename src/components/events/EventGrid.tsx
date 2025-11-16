// src/components/events/EventGrid.tsx
"use client";

/**
 * Grid layout component for displaying multiple events
 * TODO: Implement responsive grid, loading states, and empty states
 */

import { EventCard } from "./EventCard";
import { EventCardSkeleton } from "./EventCardSkeleton";
import type { Event } from "@/types";

interface EventGridProps {
  events: Event[];
  loading?: boolean;
  showSaveButton?: boolean;
  savedEventIds?: Set<string>;
  onEventClick?: (event: Event) => void;
}

export function EventGrid({
  events,
  loading = false,
  showSaveButton = false,
  savedEventIds = new Set(),
  onEventClick,
}: EventGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-semibold mb-2">No events found</p>
        <p className="text-sm text-muted-foreground">
          Try adjusting your filters or check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          showSaveButton={showSaveButton}
          isSaved={savedEventIds.has(event.id)}
          onClick={onEventClick ? () => onEventClick(event) : undefined}
        />
      ))}
    </div>
  );
}

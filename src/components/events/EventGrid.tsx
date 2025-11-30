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
  events: (Event & { score?: number })[];
  loading?: boolean;
  showSaveButton?: boolean;
  savedEventIds?: Set<string>;
  onEventClick?: (event: Event & { score?: number }) => void;
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
        <p className="text-xl font-semibold mb-2 text-foreground">No events found</p>
        <p className="text-base text-muted-foreground max-w-md">
          Try adjusting your filters or check back later for more upcoming experiences.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      {events.map((event, index) => (
        <div 
          key={event.id} 
          className="animate-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
        >
          <EventCard
            event={event}
            showSaveButton={showSaveButton}
            isSaved={savedEventIds.has(event.id)}
            onClick={onEventClick ? () => onEventClick(event) : undefined}
          />
        </div>
      ))}
    </div>
  );
}

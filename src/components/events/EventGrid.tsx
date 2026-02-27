// src/components/events/EventGrid.tsx
"use client";

/**
 * Grid layout component for displaying multiple events
 * TODO: Implement responsive grid, loading states, and empty states
 */

import { EventCard } from "./EventCard";
import { EventGridSkeleton } from "./EventGridSkeleton";
import type { Event, InteractionSource } from "@/types";
import { CalendarOff, SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

interface EventGridProps {
  events: (Event & { score?: number })[];
  loading?: boolean;
  showSaveButton?: boolean;
  savedEventIds?: Set<string>;
  onEventClick?: (event: Event & { score?: number }) => void;
  /** Called when a user unsaves an event */
  onUnsave?: (eventId: string) => void;
  /** Source context for tracking (e.g., 'home', 'search', 'recommendation') */
  trackingSource?: InteractionSource;
  /** True when any search/filter is active — shows filter-specific empty state */
  hasFilters?: boolean;
  /** Called when user clicks "Clear Filters" in the empty state */
  onClearFilters?: () => void;
}

export function EventGrid({
  events,
  loading = false,
  showSaveButton = false,
  savedEventIds = new Set(),
  onEventClick,
  onUnsave,
  trackingSource,
  hasFilters = false,
  onClearFilters,
}: EventGridProps) {
  if (loading) {
    return <EventGridSkeleton count={6} />;
  }

  if (events.length === 0) {
    return hasFilters ? (
      <EmptyState
        icon={SearchX}
        title="No results for these filters"
        description="Try clearing your filters or adjusting your search."
        action={onClearFilters ? { label: "Clear Filters", onClick: onClearFilters } : undefined}
      />
    ) : (
      <EmptyState
        icon={CalendarOff}
        title="No upcoming events"
        description="Check back soon for new events from McGill clubs."
      />
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
            onUnsave={onUnsave}
            onClick={onEventClick ? () => onEventClick(event) : undefined}
            trackingSource={trackingSource}
          />
        </div>
      ))}
    </div>
  );
}

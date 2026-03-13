"use client";

import { type Event } from "@/types";
import { DiscoveryCard } from "@/components/events/DiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";

interface UpcomingThisWeekSectionProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
}

export function UpcomingThisWeekSection({ events, onEventClick }: UpcomingThisWeekSectionProps) {
  if (events.length === 0) return null;

  // Filter to events within the next 7 days
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thisWeekEvents = events.filter((e) => {
    const eventDate = new Date(e.event_date);
    return eventDate >= now && eventDate <= weekFromNow;
  });

  if (thisWeekEvents.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between px-6 md:px-10 lg:px-12 mb-5">
        <h3 className="text-2xl font-extrabold text-foreground tracking-tight">Upcoming This Week</h3>
      </div>
      <ScrollRow className="px-6 md:px-10 lg:px-12">
        {thisWeekEvents.map((event) => (
          <div key={event.id} className="min-w-[260px] sm:min-w-[280px] md:min-w-[320px] w-[calc(85vw-2rem)] sm:w-[300px] md:w-[340px] lg:w-[320px] flex-shrink-0">
            <DiscoveryCard
              event={event}
              onClick={onEventClick ? () => onEventClick(event) : undefined}
            />
          </div>
        ))}
      </ScrollRow>
    </section>
  );
}

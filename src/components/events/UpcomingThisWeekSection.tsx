"use client";

import { type Event } from "@/types";
import { DiscoveryCard } from "@/components/events/DiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";
import {
  SectionHeader,
  CARD_WRAPPER_CLASS,
  SECTION_PADDING,
} from "@/components/ui/SectionRow";

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
      <SectionHeader title="Upcoming This Week" count={thisWeekEvents.length} />
      <ScrollRow className={SECTION_PADDING}>
        {thisWeekEvents.map((event) => (
          <div key={event.id} className={CARD_WRAPPER_CLASS}>
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

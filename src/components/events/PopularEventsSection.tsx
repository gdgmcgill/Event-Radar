"use client";

import { useState, useEffect } from "react";
import { type Event, type EventPopularityScore } from "@/types";
import { DiscoveryCard } from "@/components/events/DiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";
import { Flame } from "lucide-react";
import {
  SectionHeader,
  SectionSkeleton,
  SectionError,
  CARD_WRAPPER_CLASS,
  SECTION_PADDING,
} from "@/components/ui/SectionRow";

interface PopularEventsSectionProps {
  onEventClick?: (event: Event) => void;
  onEventsLoaded?: (eventIds: string[]) => void;
}

type EventWithPopularity = Event & { popularity?: EventPopularityScore | null };

export function PopularEventsSection({ onEventClick, onEventsLoaded }: PopularEventsSectionProps) {
  const [events, setEvents] = useState<EventWithPopularity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPopularEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/events/popular?sort=popularity&limit=10");
      if (!res.ok) throw new Error("Failed to fetch popular events");
      const data = await res.json();
      const evt = Array.isArray(data.events) ? (data.events as EventWithPopularity[]) : [];
      setEvents(evt);
      onEventsLoaded?.(evt.map((e) => e.id));
    } catch (err) {
      console.error("Error fetching popular events:", err);
      setError("Failed to load popular events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPopularEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const header = (
    <SectionHeader
      title="Trending Events"
      icon={<Flame className="h-6 w-6 text-orange-500" />}
      count={events.length}
    />
  );

  if (loading && events.length === 0) {
    return <SectionSkeleton header={header} />;
  }

  if (error) {
    return <SectionError message={error} onRetry={fetchPopularEvents} />;
  }

  if (events.length === 0) return null;

  return (
    <section>
      {header}
      <ScrollRow className={SECTION_PADDING}>
        {events.map((event, index) => {
          const badge = `#${index + 1}`;
          const badgeVariant = index >= 3 ? ("glass" as const) : ("default" as const);
          return (
            <div key={event.id} className={CARD_WRAPPER_CLASS}>
              <DiscoveryCard
                event={event}
                badge={badge}
                badgeVariant={badgeVariant}
                onClick={onEventClick ? () => onEventClick(event) : undefined}
              />
            </div>
          );
        })}
      </ScrollRow>
    </section>
  );
}

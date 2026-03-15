"use client";

import { useState, useEffect } from "react";
import { type Event } from "@/types";
import { DiscoveryCard } from "@/components/events/DiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";
import {
  SectionHeader,
  SectionSkeleton,
  SectionError,
  CARD_WRAPPER_CLASS,
  SECTION_PADDING,
} from "@/components/ui/SectionRow";

interface HappeningNowSectionProps {
  onEventClick?: (event: Event) => void;
}

export function HappeningNowSection({ onEventClick }: HappeningNowSectionProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHappeningNowEvents = async () => {
    try {
      setError(null);
      const res = await fetch("/api/events/happening-now");
      if (!res.ok) throw new Error("Failed to fetch happening now events");
      const data = await res.json();
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (err) {
      console.error("Error fetching happening now events:", err);
      setError("Failed to load happening now events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHappeningNowEvents();
    const interval = setInterval(fetchHappeningNowEvents, 60000);
    return () => clearInterval(interval);
  }, []);

  const header = (
    <SectionHeader
      title="Happening Now"
      liveIndicator
      count={events.length}
    />
  );

  if (loading && events.length === 0) {
    return <SectionSkeleton header={header} />;
  }

  if (error && events.length === 0) {
    return (
      <SectionError
        message={error}
        onRetry={() => { setLoading(true); fetchHappeningNowEvents(); }}
      />
    );
  }

  if (events.length === 0) return null;

  return (
    <section>
      {header}
      <ScrollRow className={SECTION_PADDING}>
        {events.map((event) => (
          <div key={event.id} className={CARD_WRAPPER_CLASS}>
            <DiscoveryCard
              event={event}
              badge="Live"
              onClick={onEventClick ? () => onEventClick(event) : undefined}
            />
          </div>
        ))}
      </ScrollRow>
    </section>
  );
}

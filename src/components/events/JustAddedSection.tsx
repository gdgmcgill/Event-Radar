"use client";

import { useState, useEffect } from "react";
import { type Event } from "@/types";
import { DiscoveryCard } from "@/components/events/DiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";
import {
  SectionHeader,
  CARD_WRAPPER_CLASS,
  SECTION_PADDING,
} from "@/components/ui/SectionRow";

interface JustAddedSectionProps {
  onEventClick?: (event: Event) => void;
}

export function JustAddedSection({ onEventClick }: JustAddedSectionProps) {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    const fetchNew = async () => {
      try {
        const res = await fetch("/api/events/new");
        if (!res.ok) return;
        const data = await res.json();
        setEvents(data.events ?? []);
      } catch {
        // Non-critical
      }
    };
    fetchNew();
  }, []);

  if (events.length === 0) return null;

  return (
    <section>
      <SectionHeader title="New on UNI-VERSE" count={events.length} />
      <ScrollRow className={SECTION_PADDING}>
        {events.map((event) => (
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

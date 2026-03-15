"use client";

import { useState, useEffect } from "react";
import type { Event } from "@/types";
import { DiscoveryCard } from "@/components/events/DiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";
import { useAuthStore } from "@/store/useAuthStore";
import {
  SectionHeader,
  CARD_WRAPPER_CLASS,
  SECTION_PADDING,
} from "@/components/ui/SectionRow";

interface FollowedClubsEventsSectionProps {
  onEventClick?: (event: Event) => void;
}

export function FollowedClubsEventsSection({ onEventClick }: FollowedClubsEventsSectionProps) {
  const user = useAuthStore((s) => s.user);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchEvents = async () => {
      try {
        const res = await fetch("/api/events/following");
        if (!res.ok) return;
        const data = await res.json();
        setEvents(data.events ?? []);
      } catch {
        // Non-critical
      }
    };
    fetchEvents();
  }, [user]);

  if (!user || events.length === 0) return null;

  return (
    <section>
      <SectionHeader title="From Clubs You Follow" count={events.length} />
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

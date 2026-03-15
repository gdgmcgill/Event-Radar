"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { type Event } from "@/types";
import { DiscoveryCard } from "@/components/events/DiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";

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
      <div className="flex items-center justify-between px-6 md:px-10 lg:px-12 mb-5">
        <h3 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-amber-500" />
          Just Added
        </h3>
      </div>
      <ScrollRow className="px-6 md:px-10 lg:px-12">
        {events.map((event) => (
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

"use client";

import { useState, useEffect } from "react";
import { type Event, type EventPopularityScore } from "@/types";
import { DiscoveryCard } from "@/components/events/DiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  if (loading && events.length === 0) {
    return (
      <section>
        <div className="flex items-center justify-between px-6 md:px-10 lg:px-12 mb-5">
          <h3 className="text-2xl font-extrabold text-foreground tracking-tight">Trending Now</h3>
        </div>
        <div className="flex px-6 md:px-10 lg:px-12 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[260px] sm:min-w-[280px] md:min-w-[320px] w-[calc(85vw-2rem)] sm:w-[300px] md:w-[340px] lg:w-[320px] aspect-[16/10] rounded-3xl bg-muted animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="px-6 md:px-10 lg:px-12">
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 bg-card rounded-2xl border border-destructive/20 p-6">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={fetchPopularEvents} variant="outline" size="sm" className="gap-2 cursor-pointer">
            <RefreshCcw className="h-3 w-3" />
            Try Again
          </Button>
        </div>
      </section>
    );
  }

  if (events.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between px-6 md:px-10 lg:px-12 mb-5">
        <h3 className="text-2xl font-extrabold text-foreground tracking-tight">Trending Now</h3>
      </div>
      <ScrollRow className="px-6 md:px-10 lg:px-12">
          {events.map((event, index) => {
            const badge = `#${index + 1}`;
            const badgeVariant = index >= 3 ? ("glass" as const) : ("default" as const);
            return (
              <div key={event.id} className="min-w-[260px] sm:min-w-[280px] md:min-w-[320px] w-[calc(85vw-2rem)] sm:w-[300px] md:w-[340px] lg:w-[320px] flex-shrink-0">
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

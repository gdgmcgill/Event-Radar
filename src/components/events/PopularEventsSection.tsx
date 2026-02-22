"use client";

import { useState, useEffect } from "react";
import { type Event, type EventPopularityScore } from "@/types";
import { EventCard } from "@/components/events/EventCard";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";
import { useSavedEvents } from "@/hooks/useSavedEvents";

interface PopularEventsSectionProps {
  onEventClick?: (event: Event) => void;
  onEventsLoaded?: (eventIds: string[]) => void;
}

type EventWithPopularity = Event & { popularity?: EventPopularityScore | null };

export function PopularEventsSection({ onEventClick, onEventsLoaded }: PopularEventsSectionProps) {
  const [events, setEvents] = useState<EventWithPopularity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);
  const { savedEventIds } = useSavedEvents(!!user);

  const fetchPopularEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/events/popular?sort=popularity&limit=3");
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
      <div className="mb-12 rounded-2xl border border-border/60 bg-muted/40 p-6">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground tracking-tight">Popular This Week</h2>
          <p className="text-muted-foreground mt-1">See what&apos;s popular between McGill students this week</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[380px] w-full rounded-2xl bg-secondary/20 animate-pulse border border-border/40" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-12 flex flex-col items-center justify-center py-10 text-center space-y-4 bg-card rounded-2xl border border-destructive/20 p-6">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchPopularEvents} variant="outline" size="sm" className="gap-2">
          <RefreshCcw className="h-3 w-3" />
          Try Again
        </Button>
      </div>
    );
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="mb-12 rounded-2xl border border-border/60 bg-muted/40 p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-foreground tracking-tight">Popular This Week</h2>
        <p className="text-muted-foreground mt-1">See what&apos;s popular between McGill students this week</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {events.map((event, i) => (
          <EventCard
            key={event.id}
            event={event}
            rank={(i + 1) as 1 | 2 | 3}
            showPopularityStats
            showSaveButton={!!user}
            isSaved={savedEventIds.has(event.id)}
            trackingSource="home"
            onClick={onEventClick ? () => onEventClick(event) : undefined}
            popularity={event.popularity}
          />
        ))}
      </div>
    </div>
  );
}

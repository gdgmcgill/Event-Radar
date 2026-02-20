"use client";

import { useState, useEffect } from "react";
import type { Event } from "@/types";
import { EventCard } from "@/components/events/EventCard";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";
import { useSavedEvents } from "@/hooks/useSavedEvents";

export function PopularEventsSection() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);
  const { savedEventIds } = useSavedEvents(!!user);

  const fetchPopularEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/events/popular?sort=popularity&limit=6");
      if (!res.ok) throw new Error("Failed to fetch popular events");
      const data = await res.json();
      
      const evt = Array.isArray(data.events) ? (data.events as Event[]) : [];
      setEvents(evt);
    } catch (err) {
      console.error("Error fetching popular events:", err);
      setError("Failed to load popular events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPopularEvents();
  }, []);

  if (loading && events.length === 0) {
    return (
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-foreground tracking-tight mb-6">Popular This Week</h2>
        <div className="flex overflow-x-auto gap-6 sm:grid sm:grid-cols-2 lg:grid-cols-3 snap-x snap-mandatory pb-4">
          {[1, 2, 3].map((i) => (
             <div key={i} className="min-w-[280px] w-[85vw] sm:w-auto sm:min-w-0 snap-center h-[380px] rounded-2xl bg-secondary/20 animate-pulse border border-border/40" />
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
    <div className="mb-12">
      <h2 className="text-3xl font-bold text-foreground tracking-tight mb-6">Popular This Week</h2>
      
      {/* Mobile: Horizontal snap scroll. Desktop: Grid */}
      <div className="flex overflow-x-auto gap-6 sm:grid sm:grid-cols-2 lg:grid-cols-3 snap-x snap-mandatory pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
        {events.map((event) => (
          <div key={event.id} className="min-w-[280px] w-[85vw] sm:w-auto sm:min-w-0 snap-center">
             <EventCard
                event={event}
                showSaveButton={!!user}
                isSaved={savedEventIds.has(event.id)}
                trackingSource="home"
              />
          </div>
        ))}
      </div>
    </div>
  );
}

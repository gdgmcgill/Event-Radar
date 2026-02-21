"use client";

import { useState, useEffect } from "react";
import { type Event, EventTag } from "@/types";
import { EventCard } from "@/components/events/EventCard";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useAuthStore } from "@/store/useAuthStore";
import { useSavedEvents } from "@/hooks/useSavedEvents";

interface PopularEventsSectionProps {
  onEventClick?: (event: Event) => void;
}

export function PopularEventsSection({ onEventClick }: PopularEventsSectionProps) {
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
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground tracking-tight">Popular This Week</h2>
          <p className="text-muted-foreground mt-1">See what's popular between McGill students this week</p>
        </div>
        <Carousel className="w-full">
          <CarouselContent className="-ml-4">
            {[1, 2, 3].map((i) => (
              <CarouselItem key={i} className="pl-4 basis-[85vw] sm:basis-1/2 lg:basis-1/3">
                <div className="h-[380px] w-full rounded-2xl bg-secondary/20 animate-pulse border border-border/40" />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
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
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-foreground tracking-tight">Popular This Week</h2>
        <p className="text-muted-foreground mt-1">See what's popular between McGill students this week</p>
      </div>
      
      <Carousel
        opts={{
          align: "start",
          loop: false,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-4">
          {events.map((event) => (
            <CarouselItem key={event.id} className="pl-4 basis-[85vw] sm:basis-1/2 lg:basis-1/3">
              <EventCard
                 event={event}
                 showSaveButton={!!user}
                 isSaved={savedEventIds.has(event.id)}
                 trackingSource="home"
                 onClick={onEventClick ? () => onEventClick(event) : undefined}
               />
            </CarouselItem>
          ))}
        </CarouselContent>
        {events.length > 3 && (
          <div className="hidden sm:block">
            <CarouselPrevious />
            <CarouselNext />
          </div>
        )}
      </Carousel>
    </div>
  );
}

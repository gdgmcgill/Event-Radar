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

interface RecommendedEventsSectionProps {
  onEventClick?: (event: Event) => void;
  // Fallback trigger if recommendation engine returns 0.
  onEmpty?: () => void;
}

export function RecommendedEventsSection({ onEventClick, onEmpty }: RecommendedEventsSectionProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);
  const { savedEventIds } = useSavedEvents(!!user);

  const fetchRecommendedEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/recommendations");
      if (!res.ok) {
        throw new Error("Failed to fetch recommendations");
      }

      const data = await res.json();
      const fetchedEvents = Array.isArray(data.recommendations) ? data.recommendations : [];
      
      if (fetchedEvents.length === 0) {
        // Fallback to Popular events if no recommendations found
        onEmpty?.();
        return;
      }

      setEvents(fetchedEvents);
    } catch (err) {
      console.error("Error fetching recommended events:", err);
      // Trigger the fallback to Popular Events on any hard failure
      onEmpty?.();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendedEvents();
  }, []);

  if (loading && events.length === 0) {
    return (
      <div className="mb-12">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground tracking-tight">Recommended For You</h2>
          <p className="text-muted-foreground mt-1">Based on your interests and saved events</p>
        </div>
        <Carousel className="w-full">
          <CarouselContent className="-ml-4">
            {[1, 2, 3, 4, 5].map((i) => (
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
        <Button onClick={fetchRecommendedEvents} variant="outline" size="sm" className="gap-2">
          <RefreshCcw className="h-3 w-3" />
          Try Again
        </Button>
      </div>
    );
  }

  if (events.length === 0) {
    return null; // The parent component (page.tsx) should catch this and fallback to PopularEventsSection via the onEmpty prop
  }

  return (
    <div className="mb-12">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
             Recommended For You
             <span className="text-sm font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full">New</span>
          </h2>
          <p className="text-muted-foreground mt-1">Based on your interests and saved events</p>
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
                 trackingSource="recommendation"
                 onClick={onEventClick ? () => onEventClick(event) : undefined}
               />
            </CarouselItem>
          ))}
        </CarouselContent>
        {/* Only show navigation arrows if there are more than 3 items on desktop */}
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

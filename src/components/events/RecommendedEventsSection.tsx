"use client";

import { useState, useEffect } from "react";
import { type Event } from "@/types";
import { DiscoveryCard } from "@/components/events/DiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";
import { AlertCircle, RefreshCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RecommendedEventsSectionProps {
  onEventClick?: (event: Event) => void;
  onEmpty?: () => void;
}

interface RecommendationWithExplanation extends Event {
  explanation?: string;
}

interface RecommendationsResponse {
  recommendations: RecommendationWithExplanation[];
  source?: "personalized" | "popular_fallback";
}

export function RecommendedEventsSection({ onEventClick, onEmpty }: RecommendedEventsSectionProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"personalized" | "popular_fallback">("personalized");

  const fetchRecommendedEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/recommendations");
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      const data: RecommendationsResponse = await res.json();
      const fetchedSource = data.source ?? "personalized";
      const fetchedEvents = Array.isArray(data.recommendations) ? data.recommendations : [];

      if (fetchedEvents.length === 0) {
        onEmpty?.();
        return;
      }

      setSource(fetchedSource);
      setEvents(fetchedEvents);
    } catch (err) {
      console.error("Error fetching recommended events:", err);
      onEmpty?.();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendedEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && events.length === 0) {
    return (
      <section>
        <div className="flex items-center justify-between px-6 md:px-10 lg:px-12 mb-5">
          <h3 className="text-2xl font-extrabold text-foreground tracking-tight">Recommended For You</h3>
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
          <Button onClick={fetchRecommendedEvents} variant="outline" size="sm" className="gap-2 cursor-pointer">
            <RefreshCcw className="h-3 w-3" />
            Try Again
          </Button>
        </div>
      </section>
    );
  }

  if (events.length === 0) return null;

  const isPersonalized = source === "personalized";
  const title = isPersonalized ? "Recommended For You" : "Popular on Campus";

  return (
    <section>
      <div className="flex items-center justify-between px-6 md:px-10 lg:px-12 mb-5">
        <div className="flex items-center gap-3">
          <h3 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            {title}
            {isPersonalized && (
              <Sparkles className="h-5 w-5 text-primary" />
            )}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchRecommendedEvents}
            disabled={loading}
            className="gap-1.5 text-muted-foreground hover:text-primary cursor-pointer"
          >
            <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>
      <ScrollRow className="px-6 md:px-10 lg:px-12">
          {events.map((event) => (
            <div key={event.id} className="min-w-[260px] sm:min-w-[280px] md:min-w-[320px] w-[calc(85vw-2rem)] sm:w-[300px] md:w-[340px] lg:w-[320px] flex-shrink-0">
              <DiscoveryCard event={event} onClick={onEventClick ? () => onEventClick(event) : undefined} />
            </div>
          ))}
      </ScrollRow>
    </section>
  );
}

"use client";

import { useState, useEffect } from "react";
import { type Event } from "@/types";
import { DiscoveryCard } from "@/components/events/DiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";
import { RefreshCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SectionHeader,
  SectionSkeleton,
  SectionError,
  CARD_WRAPPER_CLASS,
  SECTION_PADDING,
} from "@/components/ui/SectionRow";

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

  const isPersonalized = source === "personalized";
  const title = isPersonalized ? "Recommended For You" : "Popular on Campus";

  const header = (
    <SectionHeader
      title={title}
      icon={isPersonalized ? <Sparkles className="h-5 w-5 text-primary" /> : undefined}
      count={events.length}
      action={
        events.length > 0 ? (
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
        ) : undefined
      }
    />
  );

  if (loading && events.length === 0) {
    return (
      <SectionSkeleton
        header={<SectionHeader title="Recommended For You" />}
      />
    );
  }

  if (error) {
    return <SectionError message={error} onRetry={fetchRecommendedEvents} />;
  }

  if (events.length === 0) return null;

  return (
    <section>
      {header}
      <ScrollRow className={SECTION_PADDING}>
        {events.map((event) => (
          <div key={event.id} className={CARD_WRAPPER_CLASS}>
            <DiscoveryCard event={event} onClick={onEventClick ? () => onEventClick(event) : undefined} />
          </div>
        ))}
      </ScrollRow>
    </section>
  );
}

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

interface RecommendationItem {
  event_id: string;
  score: number;
  explanation?: string;
  event: Event;
}

interface RecommendationsResponse {
  recommendations: RecommendationItem[];
  source?: "personalized" | "popular_fallback" | "anonymous";
}

export function RecommendedEventsSection({ onEventClick, onEmpty }: RecommendedEventsSectionProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchRecommendedEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/recommendations");
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`[Recommendations] ${res.status} ${res.statusText}`, text.slice(0, 500));
        throw new Error("Failed to fetch recommendations");
      }
      const data: RecommendationsResponse = await res.json();
      const fetchedSource = data.source ?? "personalized";
      const fetchedEvents = Array.isArray(data.recommendations) ? data.recommendations : [];

      // Only show this section for personalized recommendations;
      // fallback/anonymous results are redundant with Trending Events
      if (fetchedSource !== "personalized" || fetchedEvents.length === 0) {
        onEmpty?.();
        return;
      }

      // Extract nested event objects and deduplicate
      const seen = new Set<string>();
      const unique = fetchedEvents
        .map((rec) => rec.event)
        .filter((e): e is Event => {
          if (!e?.id || seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });
      setEvents(unique);
    } catch (err) {
      console.error("Error fetching recommended events:", err);
      setError("Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendedEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const header = (
    <SectionHeader
      title="Recommended For You"
      icon={<Sparkles className="h-5 w-5 text-primary" />}
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
        {events.map((event, idx) => (
          <div key={event.id ?? `rec-${idx}`} className={CARD_WRAPPER_CLASS}>
            <DiscoveryCard event={event} onClick={onEventClick ? () => onEventClick(event) : undefined} />
          </div>
        ))}
      </ScrollRow>
    </section>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { type Event } from "@/types";
import { EventCard } from "@/components/events/EventCard";
import { EventCardSkeleton } from "@/components/events/EventCardSkeleton";
import { AlertCircle, RefreshCcw, ChevronLeft, ChevronRight, BookmarkPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { RECOMMENDATION_THRESHOLD } from "@/lib/constants";

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
  const [thumbsFeedbackByEventId, setThumbsFeedbackByEventId] = useState<
    Record<string, "positive" | "negative">
  >({});
  const [explanationByEventId, setExplanationByEventId] = useState<
    Record<string, string>
  >({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showPrev, setShowPrev] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const user = useAuthStore((s) => s.user);
  const { savedEventIds, isLoading } = useSavedEvents(!!user);

  const updateButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowPrev(el.scrollLeft > 4);
    setShowNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateButtons();
    el.addEventListener("scroll", updateButtons, { passive: true });
    const ro = new ResizeObserver(updateButtons);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateButtons);
      ro.disconnect();
    };
  }, [events, updateButtons]);

  const scrollPrev = () =>
    scrollRef.current?.scrollBy({ left: -(scrollRef.current.clientWidth * 0.8), behavior: "smooth" });
  const scrollNext = () =>
    scrollRef.current?.scrollBy({ left: scrollRef.current.clientWidth * 0.8, behavior: "smooth" });

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

      const explanations: Record<string, string> = {};
      for (const ev of fetchedEvents) {
        if (ev.explanation) {
          explanations[ev.id] = ev.explanation;
        }
      }
      setExplanationByEventId(explanations);

      const ids = fetchedEvents.map((e) => e.id).join(",");
      if (ids) {
        try {
          const fbRes = await fetch(`/api/recommendations/feedback?event_ids=${encodeURIComponent(ids)}`);
          if (fbRes.ok) {
            const fbData = (await fbRes.json()) as { feedback: Record<string, "positive" | "negative"> };
            setThumbsFeedbackByEventId(fbData.feedback ?? {});
          }
        } catch {
          // Feedback hydration is best-effort
        }
      }
    } catch (err) {
      console.error("Error fetching recommended events:", err);
      onEmpty?.();
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = useCallback((eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  }, []);

  const handleSaveToggle = useCallback((eventId: string, saved: boolean) => {
    if (saved) {
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    }
  }, []);

  useEffect(() => {
    fetchRecommendedEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only fetch
  }, []);

  if (loading && events.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="px-6 pt-6 mb-6">
          <SectionHeader source="personalized" />
        </div>
        <div className="px-4 sm:px-6 pb-6">
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shrink-0 w-full sm:w-[46%] lg:w-[30%]">
                <EventCardSkeleton />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 bg-card rounded-2xl border border-destructive/20 p-6">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchRecommendedEvents} variant="outline" size="sm" className="gap-2 cursor-pointer">
          <RefreshCcw className="h-3 w-3" />
          Try Again
        </Button>
      </div>
    );
  }

  if (events.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="px-6 pt-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <SectionHeader source={source} />
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchRecommendedEvents}
            disabled={loading}
            className="gap-1.5 text-muted-foreground hover:text-primary cursor-pointer flex-shrink-0"
          >
            <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
        {source === "popular_fallback" && !isLoading && (() => {
          const remaining = Math.max(0, RECOMMENDATION_THRESHOLD - savedEventIds.size);
          return remaining > 0 ? (
            <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1.5">
              <BookmarkPlus className="h-4 w-4 text-primary" />
              Save {remaining} more event{remaining !== 1 ? "s" : ""} to unlock personalized recommendations
            </p>
          ) : null;
        })()}
      </div>

      <div className="relative px-4 sm:px-6 pb-6">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {events.map((event, index) => (
            <div key={event.id} className="shrink-0 snap-start w-full sm:w-[46%] lg:w-[30%]">
              <EventCard
                event={event}
                showSaveButton={!!user}
                isSaved={savedEventIds.has(event.id)}
                trackingSource="recommendation"
                recommendationRank={index + 1}
                onDismiss={handleDismiss}
                onSaveToggle={handleSaveToggle}
                explanation={explanationByEventId[event.id] ?? null}
                initialThumbsFeedback={thumbsFeedbackByEventId[event.id] ?? null}
                onClick={onEventClick ? () => onEventClick(event) : undefined}
              />
            </div>
          ))}
        </div>

        {showPrev && (
          <button
            onClick={scrollPrev}
            className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-border bg-card shadow-md items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {showNext && (
          <button
            onClick={scrollNext}
            className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-border bg-card shadow-md items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ source }: { source: "personalized" | "popular_fallback" }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
          {source === "popular_fallback" ? "Popular on Campus" : "Recommended For You"}
          {source === "personalized" && (
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">New</span>
          )}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {source === "popular_fallback"
            ? "Trending events from across campus"
            : "Based on your interests and saved events"}
        </p>
      </div>
    </div>
  );
}

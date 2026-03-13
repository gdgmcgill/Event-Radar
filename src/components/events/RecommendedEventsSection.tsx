"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { type Event } from "@/types";
import { DiscoveryCard } from "@/components/events/DiscoveryCard";
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
      {source === "popular_fallback" && !isLoading && (() => {
        const remaining = Math.max(0, RECOMMENDATION_THRESHOLD - savedEventIds.size);
        return remaining > 0 ? (
          <p className="text-sm text-muted-foreground px-6 md:px-10 lg:px-12 mb-4 flex items-center gap-1.5">
            <BookmarkPlus className="h-4 w-4 text-primary" />
            Save {remaining} more event{remaining !== 1 ? "s" : ""} to unlock personalized recommendations
          </p>
        ) : null;
      })()}
      <div className="relative group/row">
        {showPrev && (
          <button
            onClick={scrollPrev}
            className="absolute left-0 top-0 bottom-0 w-12 bg-white/70 dark:bg-black/40 backdrop-blur-sm text-foreground dark:text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-300 z-30 cursor-pointer rounded-r-md hover:bg-white/90 dark:hover:bg-black/70 hover:w-14"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto px-6 md:px-10 lg:px-12 gap-3 pb-4 scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {events.map((event) => (
            <div key={event.id} className="min-w-[260px] sm:min-w-[280px] md:min-w-[320px] w-[calc(85vw-2rem)] sm:w-[300px] md:w-[340px] lg:w-[320px] flex-shrink-0">
              <DiscoveryCard
                event={event}
                onClick={onEventClick ? () => onEventClick(event) : undefined}
              />
            </div>
          ))}
        </div>
        {showNext && (
          <button
            onClick={scrollNext}
            className="absolute right-0 top-0 bottom-0 w-12 bg-white/70 dark:bg-black/40 backdrop-blur-sm text-foreground dark:text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-300 z-30 cursor-pointer rounded-l-md hover:bg-white/90 dark:hover:bg-black/70 hover:w-14"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        )}
      </div>
    </section>
  );
}

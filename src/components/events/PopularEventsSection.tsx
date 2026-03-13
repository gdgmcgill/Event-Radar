"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { type Event, type EventPopularityScore } from "@/types";
import { DiscoveryCard } from "@/components/events/DiscoveryCard";
import { AlertCircle, RefreshCcw, ChevronLeft, ChevronRight } from "lucide-react";
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showPrev, setShowPrev] = useState(false);
  const [showNext, setShowNext] = useState(false);

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
          {events.map((event) => {
            const badge =
              event.popularity?.trending_score && event.popularity.trending_score >= 5
                ? "Trending"
                : undefined;
            return (
              <div key={event.id} className="min-w-[260px] sm:min-w-[280px] md:min-w-[320px] w-[calc(85vw-2rem)] sm:w-[300px] md:w-[340px] lg:w-[320px] flex-shrink-0">
                <DiscoveryCard
                  event={event}
                  badge={badge}
                  onClick={onEventClick ? () => onEventClick(event) : undefined}
                />
              </div>
            );
          })}
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

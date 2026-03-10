"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { type Event } from "@/types";
import { EventCard } from "@/components/events/EventCard";
import { AlertCircle, RefreshCcw, ChevronLeft, ChevronRight, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { EventCardSkeleton } from "@/components/events/EventCardSkeleton";

interface HappeningNowSectionProps {
  onEventClick?: (event: Event) => void;
}

export function HappeningNowSection({ onEventClick }: HappeningNowSectionProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showPrev, setShowPrev] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const user = useAuthStore((s) => s.user);
  const { savedEventIds } = useSavedEvents(!!user);

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

  const fetchHappeningNowEvents = async () => {
    try {
      setError(null);
      const res = await fetch("/api/events/happening-now");
      if (!res.ok) throw new Error("Failed to fetch happening now events");
      const data = await res.json();
      const fetchedEvents = Array.isArray(data.events) ? data.events : [];
      setEvents(fetchedEvents);
    } catch (err) {
      console.error("Error fetching happening now events:", err);
      setError("Failed to load happening now events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHappeningNowEvents();
    const interval = setInterval(() => {
      fetchHappeningNowEvents();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && events.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <SectionHeader loading />
        <div className="flex gap-4 overflow-hidden mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shrink-0 w-full sm:w-[46%] lg:w-[30%]">
              <EventCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 bg-card rounded-2xl border border-destructive/20 p-6">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => { setLoading(true); fetchHappeningNowEvents(); }} variant="outline" size="sm" className="gap-2 cursor-pointer">
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
    <div className="rounded-2xl border border-primary/20 bg-card relative overflow-hidden">
      {/* Subtle accent glow */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

      <div className="px-6 pt-6 mb-4">
        <SectionHeader />
      </div>

      <div className="relative px-4 sm:px-6 pb-6">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {events.map((event) => (
            <div key={event.id} className="shrink-0 snap-start w-full sm:w-[46%] lg:w-[30%]">
              <EventCard
                event={event}
                showSaveButton={!!user}
                isSaved={savedEventIds.has(event.id)}
                trackingSource="home"
                onClick={onEventClick ? () => onEventClick(event) : undefined}
              />
            </div>
          ))}
        </div>

        {showPrev && (
          <button
            onClick={scrollPrev}
            className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-border bg-card shadow-md items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors z-10 cursor-pointer"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {showNext && (
          <button
            onClick={scrollNext}
            className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-border bg-card shadow-md items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors z-10 cursor-pointer"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ loading }: { loading?: boolean }) {
  return (
    <div className="flex justify-between items-start">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
          <Radio className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            Happening Now
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Events starting within the next 2 hours</p>
        </div>
      </div>
      {!loading && (
        <span className="hidden sm:inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
          Auto-refreshes
        </span>
      )}
    </div>
  );
}

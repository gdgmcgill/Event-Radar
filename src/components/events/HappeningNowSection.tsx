"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { type Event } from "@/types";
import { EventCard } from "@/components/events/EventCard";
import { AlertCircle, RefreshCcw, ArrowLeft, ArrowRight, Clock } from "lucide-react";
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

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchHappeningNowEvents();
    }, 60000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only fetch + interval
  }, []);

  if (loading && events.length === 0) {
    return (
      <div className="mb-12 w-full isolate overflow-hidden rounded-2xl border border-border/60 bg-muted/40">
        <div className="px-6 pt-6 mb-6">
          <h2 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            Happening Now
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          </h2>
          <p className="text-muted-foreground mt-1">Events starting within the next 2 hours</p>
        </div>
        <div className="px-4 sm:px-12 pb-6">
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

  if (error && events.length === 0) {
    return (
      <div className="mb-12 flex flex-col items-center justify-center py-10 text-center space-y-4 bg-card rounded-2xl border border-destructive/20 p-6">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => { setLoading(true); fetchHappeningNowEvents(); }} variant="outline" size="sm" className="gap-2">
          <RefreshCcw className="h-3 w-3" />
          Try Again
        </Button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="mb-12 w-full isolate overflow-hidden rounded-2xl border border-border/60 bg-muted/40 p-6 sm:p-10 flex flex-col items-center justify-center text-center">
        <div className="bg-background p-4 rounded-full mb-4 shadow-sm">
          <Clock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight mb-2">
          Nothing Happening Right Now
        </h2>
        <p className="text-muted-foreground max-w-md">
          There are no events scheduled to start within the next two hours. Check out our upcoming or recommended events below!
        </p>
      </div>
    );
  }

  return (
    <div className="mb-12 w-full isolate overflow-hidden rounded-2xl border border-border/60 bg-muted/40 relative">
      <div className="px-6 pt-6 mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            Happening Now
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          </h2>
          <p className="text-muted-foreground mt-1">Events starting within the next 2 hours</p>
        </div>
        <div className="hidden sm:block">
           <span className="text-xs font-medium px-2 py-1 rounded bg-background text-muted-foreground border border-border">
             Auto-refreshes
           </span>
        </div>
      </div>

      <div className="relative px-4 sm:px-12 pb-6">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border border-input bg-background shadow-sm items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors z-10"
            aria-label="Scroll left"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {showNext && (
          <button
            onClick={scrollNext}
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border border-input bg-background shadow-sm items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors z-10"
            aria-label="Scroll right"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * Home page - Main event calendar/browse view
 */

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Event, EventTag } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { useEvents } from "@/hooks/useEvents";

import { EventFilters } from "@/components/events/EventFilters";
import { EventGrid } from "@/components/events/EventGrid";
import { EventDetailsModal } from "@/components/events/EventDetailsModal";
import { EventSearch } from "@/components/events/EventSearch";
import { Filter, RefreshCcw, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  not_mcgill: "Please sign in with a McGill email (@mcgill.ca or @mail.mcgill.ca).",
  auth_failed: "Authentication failed. Please try again.",
  no_code: "Authentication error. Please try again.",
  not_authenticated: "Could not verify your account. Please try again.",
};
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type ScoredEvent = Event & { score?: number };

export default function HomePage() {
  return (
    <Suspense>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const [events, setEvents] = useState<ScoredEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<EventTag[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore((s) => s.user);
  const { savedEventIds } = useSavedEvents(!!user);
  const searchParams = useSearchParams();
  const router = useRouter();

  const NUMBER_OF_EVENTS_PER_BATCH = 20;

  const { fetchPage } = useEvents({
    enabled: false,
    limit: NUMBER_OF_EVENTS_PER_BATCH,
    sort: "start_date",
    direction: "asc",
  });

  // Read auth error from URL query params
  useEffect(() => {
    const errorCode = searchParams.get("error");
    if (errorCode && AUTH_ERROR_MESSAGES[errorCode]) {
      setAuthError(AUTH_ERROR_MESSAGES[errorCode]);
      router.replace("/");
    }
  }, [searchParams, router]);

  const fetchUpcomingEventsPage = useCallback(
    async (cursor: string | null = null): Promise<{ events: ScoredEvent[]; nextCursor: string | null }> => {
      const dateOnly = new Date().toISOString().split("T")[0];
      const dateFrom = new Date(dateOnly);

      const { events, nextCursor } = await fetchPage({
        filters: {
          dateRange: {
            start: dateFrom,
          },
        },
        cursor,
      });

      return {
        events: events as ScoredEvent[],
        nextCursor,
      };
    },
    [fetchPage]
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    try {
      setLoadingMore(true);
      const { events: newEvents, nextCursor: newCursor } =
        await fetchUpcomingEventsPage(nextCursor);
      setEvents((prev) => [...prev, ...newEvents]);
      setNextCursor(newCursor);
    } catch (err) {
      console.error("Error loading more events:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, fetchUpcomingEventsPage]);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch first page of upcoming events
      const { events: upcomingPage, nextCursor: cursor } =
        await fetchUpcomingEventsPage();
      
      setEvents(upcomingPage);
      setNextCursor(cursor);

      // Try recommendations if authenticated
      if (user) {
        try {
          const recResponse = await fetch("/api/recommendations");
          if (recResponse.ok) {
            const data = await recResponse.json();
            const recs = Array.isArray(data.recommendations)
              ? data.recommendations
              : [];
            if (recs.length > 0) {
              setEvents(recs);
              setNextCursor(null);
            }
          }
        } catch (err) {
          console.error("Recommendations failed:", err);
        }
      }
    } catch (err) {
      console.error("Error fetching events:", err);
      setError("Failed to load events. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [fetchUpcomingEventsPage, user]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Global "/" keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const applyFilters = useCallback(
    (list: ScoredEvent[]) => {
      let result = list;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        result = result.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q)
        );
      }
      if (selectedTags.length > 0) {
        result = result.filter((e) =>
          e.tags.some((tag) => selectedTags.includes(tag))
        );
      }
      return result;
    },
    [searchQuery, selectedTags]
  );

  const filteredEvents = useMemo(
    () => applyFilters(events),
    [events, applyFilters]
  );

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleFilterChange = useCallback(
    (filters: { tags?: EventTag[]; dateRange?: { start: Date; end: Date }; clubId?: string }) => {
      setSelectedTags(filters.tags ?? []);
    },
    []
  );

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const isFiltering = searchQuery.trim().length > 0 || selectedTags.length > 0;

  return (
    <ErrorBoundary fallbackMessage="We couldn't load events right now.">
      <div className="flex flex-col min-h-screen bg-background font-sans">
        {/* Auth Error Banner */}
        {authError && (
          <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3">
            <div className="container mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
              <button
                type="button"
                onClick={() => setAuthError(null)}
                className="text-destructive/70 hover:text-destructive transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <section className="relative w-full pt-24 pb-32 md:pt-32 md:pb-40 overflow-hidden bg-secondary/30">
          <div className="container mx-auto px-4 relative z-10 flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Live on Campus
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 leading-[1.1]">
              Find your next <span className="text-primary">experience.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200 leading-relaxed">
              Discover workshops, hackathons, and social events happening right now at McGill University.
            </p>

            {/* Centralized Search */}
            <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 flex justify-center">
              <EventSearch
                ref={searchInputRef}
                onSearchChange={handleSearchChange}
                variant="hero"
                placeholder="Search events, clubs, or categories..."
              />
            </div>
          </div>

          {/* Decorative Background Elements */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-[30%] -left-[10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[120px]"></div>
            <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[100px]"></div>
          </div>
        </section>

        <div className="container mx-auto px-4 py-12 -mt-16 relative z-20">
          <div className="flex flex-col gap-8">

            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
              <h2 className="text-3xl font-bold text-foreground tracking-tight">Upcoming Events</h2>

              <div className="flex items-center gap-3">
                <div className="hidden md:block">
                  {/* We can place refined quick filters here or keep them in the modal/sidebar */}
                </div>

                {/* Mobile/Desktop Filter Toggle */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="gap-2 rounded-xl border-border/60 bg-card/50 backdrop-blur-sm hover:bg-card hover:text-primary transition-all shadow-sm">
                      <Filter className="h-4 w-4" />
                      Filters
                      {selectedTags.length > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                          {selectedTags.length}
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[300px] sm:w-[400px] border-l-border/60">
                    <SheetHeader>
                      <SheetTitle className="text-2xl font-bold">Filters</SheetTitle>
                      <SheetDescription>
                        Refine your event search by category, date, or club.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="py-6">
                      <EventFilters onFilterChange={handleFilterChange} initialTags={selectedTags} />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {/* Result count feedback */}
            {isFiltering && !loading && !error && (
              <div className="text-sm text-muted-foreground">
                Showing {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
                {searchQuery.trim() && (
                  <> for &ldquo;{searchQuery.trim()}&rdquo;</>
                )}
                {selectedTags.length > 0 && (
                  <> in {selectedTags.length} categor{selectedTags.length !== 1 ? "ies" : "y"}</>
                )}
              </div>
            )}

            {/* Main Content */}
            <div className="min-h-[500px]">
              {error ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-card rounded-2xl border border-destructive/20 p-8">
                  <div className="rounded-full bg-destructive/10 p-4">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-foreground">Something went wrong</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">{error}</p>
                  </div>
                  <Button onClick={fetchEvents} variant="outline" className="gap-2">
                    <RefreshCcw className="h-4 w-4" />
                    Try Again
                  </Button>
                </div>
              ) : (
                <EventGrid
                  events={filteredEvents}
                  loading={loading}
                  onEventClick={handleEventClick}
                  showSaveButton={!!user}
                  savedEventIds={savedEventIds}
                  trackingSource="home"
                />
              )}
            </div>

            {/* Load More Button */}
            {nextCursor && !error && (
              <div className="flex justify-center mt-8">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="gap-2"
                >
                  {loadingMore ? "Loading..." : "Load More Events"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Event Details Modal */}
        <EventDetailsModal
          open={isModalOpen}
          onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) setSelectedEvent(null);
          }}
          event={selectedEvent}
          trackingSource="home"
        />
      </div>
    </ErrorBoundary>
  );
}

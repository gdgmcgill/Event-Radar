"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Event, EventTag } from "@/types";
import { EVENT_TAGS } from "@/lib/constants";
import { tagMapping } from "@/lib/tagMapping";
import { useAuthStore } from "@/store/useAuthStore";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { useEvents } from "@/hooks/useEvents";
import { CategorySection, CategorySectionSkeleton } from "@/components/events/CategorySection";
import { EventDetailsModal } from "@/components/events/EventDetailsModal";
import { AlertCircle, RefreshCcw, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";

const buildEmptyEvents = (): Record<EventTag, Event[]> =>
  Object.fromEntries(EVENT_TAGS.map((tag) => [tag, [] as Event[]])) as Record<EventTag, Event[]>;

const buildEmptyCursors = (): Record<EventTag, string | null> =>
  Object.fromEntries(EVENT_TAGS.map((tag) => [tag, null])) as Record<EventTag, string | null>;

const buildEmptyLoading = (): Record<EventTag, boolean> =>
  Object.fromEntries(EVENT_TAGS.map((tag) => [tag, false])) as Record<EventTag, boolean>;

const getDbTagsForCategory = (tag: EventTag): string[] => {
  const dbTags = Object.entries(tagMapping)
    .filter(([, mappedTag]) => mappedTag === tag)
    .map(([dbTag]) => dbTag);

  const uniqueTags = Array.from(new Set(dbTags));
  return uniqueTags.length > 0 ? uniqueTags : [tag];
};

export default function CategoriesPage() {
  const [eventsByTag, setEventsByTag] = useState<Record<EventTag, Event[]>>(buildEmptyEvents);
  const [nextCursorByTag, setNextCursorByTag] = useState<Record<EventTag, string | null>>(buildEmptyCursors);
  const [loadingByTag, setLoadingByTag] = useState<Record<EventTag, boolean>>(buildEmptyLoading);
  const [prefetchedByTag, setPrefetchedByTag] = useState<Record<EventTag, { events: Event[]; nextCursor: string | null } | null>>(
    Object.fromEntries(EVENT_TAGS.map((tag) => [tag, null])) as Record<EventTag, { events: Event[]; nextCursor: string | null } | null>
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Use refs to track prefetching state to avoid stale closures
  const prefetchingRef = useRef<Record<EventTag, boolean>>(buildEmptyLoading());
  const prefetchedCursorRef = useRef<Record<EventTag, string | null>>(buildEmptyCursors());
  
  const user = useAuthStore((s) => s.user);
  const { savedEventIds } = useSavedEvents(!!user);

  const { fetchPage } = useEvents({
    enabled: false,
    limit: 20,
    sort: "start_date",
    direction: "asc",
  });

  const fetchCategoryPage = useCallback(async (tag: EventTag, cursor?: string | null) => {
    const dbTags = getDbTagsForCategory(tag);
    return {
      ...(await fetchPage({
        filters: {
          tags: dbTags,
        },
        cursor,
      })),
    };
  }, [fetchPage]);

  // Prefetch the next page for a category
  const prefetchNextPage = useCallback(async (tag: EventTag, cursor: string | null) => {
    // Don't prefetch if no cursor, already prefetching, or already prefetched this cursor
    if (!cursor || prefetchingRef.current[tag] || prefetchedCursorRef.current[tag] === cursor) {
      return;
    }
    
    prefetchingRef.current[tag] = true;
    prefetchedCursorRef.current[tag] = cursor;
    
    try {
      const result = await fetchCategoryPage(tag, cursor);
      setPrefetchedByTag((prev) => ({
        ...prev,
        [tag]: {
          events: result.events,
          nextCursor: result.nextCursor,
        },
      }));
    } catch (err) {
      console.error(`Error prefetching ${tag} events:`, err);
      // Reset on error so it can be retried
      prefetchedCursorRef.current[tag] = null;
    } finally {
      prefetchingRef.current[tag] = false;
    }
  }, [fetchCategoryPage]);

  const loadInitial = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const results = await Promise.all(
        EVENT_TAGS.map((tag) => fetchCategoryPage(tag).catch((err) => {
          console.error(`Error fetching ${tag} events:`, err);
          return { events: [], nextCursor: null, total: 0, prevCursor: null };
        }))
      );

      const nextEvents = buildEmptyEvents();
      const nextCursors = buildEmptyCursors();

      results.forEach((result, index) => {
        const tag = EVENT_TAGS[index];
        nextEvents[tag] = result.events;
        nextCursors[tag] = result.nextCursor;
      });

      setEventsByTag(nextEvents);
      setNextCursorByTag(nextCursors);
      setLoadingByTag(buildEmptyLoading());
      
      // Prefetch first page for all categories with more data
      results.forEach((result, index) => {
        const tag = EVENT_TAGS[index];
        if (result.nextCursor) {
          prefetchNextPage(tag, result.nextCursor);
        }
      });
    } catch (err) {
      console.error("Error fetching events:", err);
      setError("Failed to load events. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [fetchCategoryPage, prefetchNextPage]);

  const handleLoadMore = useCallback(
    async (tag: EventTag) => {
      const cursor = nextCursorByTag[tag];
      const prefetched = prefetchedByTag[tag];
      
      // If no cursor, nothing to load
      if (!cursor) return;

      // Prevent double-loading
      if (loadingByTag[tag]) return;

      // If we have prefetched data, use it immediately
      if (prefetched) {
        setEventsByTag((prev) => ({
          ...prev,
          [tag]: [...prev[tag], ...prefetched.events],
        }));
        setNextCursorByTag((prev) => ({ ...prev, [tag]: prefetched.nextCursor }));
        setPrefetchedByTag((prev) => ({ ...prev, [tag]: null }));
        prefetchedCursorRef.current[tag] = null; // Reset ref
        
        // Prefetch the next batch
        if (prefetched.nextCursor) {
          prefetchNextPage(tag, prefetched.nextCursor);
        }
        return;
      }

      // Otherwise, fetch normally
      setLoadingByTag((prev) => ({ ...prev, [tag]: true }));

      try {
        const { events, nextCursor } = await fetchCategoryPage(tag, cursor);
        setEventsByTag((prev) => ({
          ...prev,
          [tag]: [...prev[tag], ...events],
        }));
        setNextCursorByTag((prev) => ({ ...prev, [tag]: nextCursor }));
        
        // Prefetch the next batch
        if (nextCursor) {
          prefetchNextPage(tag, nextCursor);
        }
      } catch (err) {
        console.error(`Error loading more ${tag} events:`, err);
      } finally {
        setLoadingByTag((prev) => ({ ...prev, [tag]: false }));
      }
    },
    [fetchCategoryPage, nextCursorByTag, prefetchedByTag, loadingByTag, prefetchNextPage]
  );

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Page Header */}
      <section className="w-full pt-12 pb-8 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
              <Tag className="h-5 w-5" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
              Browse by Category
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Explore events organized by category. Find exactly what interests you.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="container mx-auto px-4 py-10">
        {error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-card rounded-2xl border border-destructive/20 p-8">
            <div className="rounded-full bg-destructive/10 p-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-foreground">Something went wrong</h3>
              <p className="text-muted-foreground max-w-md mx-auto">{error}</p>
            </div>
            <Button onClick={loadInitial} variant="outline" className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-12">
            {EVENT_TAGS.map((tag) => (
              <CategorySectionSkeleton key={tag} />
            ))}
          </div>
        ) : (
          <div className="space-y-12">
            {EVENT_TAGS.map((tag) => (
              <CategorySection
                key={tag}
                tag={tag}
                events={eventsByTag[tag] || []}
                onEventClick={handleEventClick}
                showSaveButton={!!user}
                savedEventIds={savedEventIds}
                hasMore={Boolean(nextCursorByTag[tag])}
                onLoadMore={() => handleLoadMore(tag)}
              />
            ))}
          </div>
        )}
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
  );
}

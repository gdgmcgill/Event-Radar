"use client";

/**
 * Custom hook for fetching and managing events with cursor-based pagination
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Event, EventFilter } from "@/types";

type SortField = "start_date" | "created_at" | "popularity_score" | "trending_score";
type SortDirection = "asc" | "desc";

interface UseEventsOptions {
  filters?: EventFilter;
  enabled?: boolean;
  limit?: number;
  sort?: SortField;
  direction?: SortDirection;
}

interface FetchPageOptions {
  filters?: EventFilter;
  cursor?: string | null;
  limit?: number;
  sort?: SortField;
  direction?: SortDirection;
}

interface FetchPageResult {
  events: Event[];
  total: number;
  nextCursor: string | null;
  prevCursor: string | null;
}

interface UseEventsResult {
  events: Event[];
  loading: boolean;
  loadingMore: boolean;
  error: Error | null;
  total: number;
  nextCursor: string | null;
  prevCursor: string | null;
  refetch: () => void;
  loadMore: () => void;
  goToNext: () => void;
  goToPrev: () => void;
  fetchPage: (options?: FetchPageOptions) => Promise<FetchPageResult>;
  loadAll: (options?: Omit<FetchPageOptions, "cursor">) => Promise<void>;
}

/**
 * Build query string from EventFilter with cursor pagination
 */
function buildQueryParams(
  filters: EventFilter | undefined,
  cursor: string | null,
  limit: number,
  sort: SortField,
  direction: SortDirection
): string {
  const params = new URLSearchParams();

  params.set("limit", limit.toString());
  params.set("sort", sort);
  params.set("direction", direction);

  if (cursor) {
    params.set("cursor", cursor);
  }

  if (filters?.tags && filters.tags.length > 0) {
    params.set("tags", filters.tags.join(","));
  }

  if (filters?.searchQuery) {
    params.set("search", filters.searchQuery);
  }

  if (filters?.dateRange?.start) {
    params.set("dateFrom", filters.dateRange.start.toISOString());
  }

  if (filters?.dateRange?.end) {
    params.set("dateTo", filters.dateRange.end.toISOString());
  }

  if (filters?.clubId) {
    params.set("clubId", filters.clubId);
  }

  return params.toString();
}

export function useEvents(options: UseEventsOptions = {}): UseEventsResult {
  const { filters, enabled = true, limit = 50, sort = "start_date", direction = "asc" } = options;

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);

  // Stack for going back to previous pages
  const cursorStackRef = useRef<string[]>([]);

  // Track previous filters to reset cursor when they change
  const prevFiltersRef = useRef<string>("");

  const fetchPage = useCallback(
    async (options: FetchPageOptions = {}): Promise<FetchPageResult> => {
      const queryString = buildQueryParams(
        options.filters ?? filters,
        options.cursor ?? cursor,
        options.limit ?? limit,
        options.sort ?? sort,
        options.direction ?? direction
      );
      const response = await fetch(`/api/events?${queryString}`);

      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await response.json();
      const eventList = Array.isArray(data) ? data : data.events || [];

      return {
        events: eventList,
        total: data.total || 0,
        nextCursor: data.nextCursor ?? null,
        prevCursor: data.prevCursor ?? null,
      };
    },
    [cursor, direction, filters, limit, sort]
  );

  const applyPageResult = useCallback((result: FetchPageResult, append = false) => {
    setEvents((prev) => (append ? [...prev, ...result.events] : result.events));
    setTotal(result.total);
    setNextCursor(result.nextCursor);
    setPrevCursor(result.prevCursor);
  }, []);

  const fetchEvents = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await fetchPage({ cursor });
      applyPageResult(result);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch events"));
    } finally {
      setLoading(false);
    }
  }, [enabled, fetchPage, cursor, applyPageResult]);

  // Reset cursor when filters change
  useEffect(() => {
    const filtersKey = JSON.stringify(filters || {});
    if (prevFiltersRef.current && prevFiltersRef.current !== filtersKey) {
      setCursor(null);
      cursorStackRef.current = [];
    }
    prevFiltersRef.current = filtersKey;
  }, [filters]);

  // Fetch events when dependencies change
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const goToNext = useCallback(() => {
    if (nextCursor) {
      cursorStackRef.current.push(cursor || "");
      setCursor(nextCursor);
    }
  }, [nextCursor, cursor]);

  const goToPrev = useCallback(() => {
    if (prevCursor) {
      const previousCursor = cursorStackRef.current.pop();
      setCursor(previousCursor ?? null);
    }
  }, [prevCursor]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) {
      return;
    }

    try {
      setLoadingMore(true);
      setError(null);

      const result = await fetchPage({ cursor: nextCursor });
      applyPageResult(result, true);
    } catch (err) {
      console.error("Error loading more events:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch events"));
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, fetchPage, applyPageResult]);

  const loadAll = useCallback(
    async (options: Omit<FetchPageOptions, "cursor"> = {}) => {
      try {
        setLoading(true);
        setError(null);
        setCursor(null);
        cursorStackRef.current = [];

        let currentCursor: string | null = null;
        let page = 0;

        while (true) {
          const { events: pageEvents, total, nextCursor } = await fetchPage({
            ...options,
            cursor: currentCursor,
          });

          if (page === 0) {
            setEvents(pageEvents);
          } else {
            setEvents((prev) => [...prev, ...pageEvents]);
          }

          setTotal(total);
          setNextCursor(nextCursor);
          setPrevCursor(null);

          if (!nextCursor) {
            break;
          }

          currentCursor = nextCursor;
          page += 1;
        }
      } catch (err) {
        console.error("Error fetching events:", err);
        setError(err instanceof Error ? err : new Error("Failed to fetch events"));
      } finally {
        setLoading(false);
      }
    },
    [fetchPage]
  );

  return {
    events,
    loading,
    loadingMore,
    error,
    total,
    nextCursor,
    prevCursor,
    refetch: fetchEvents,
    loadMore,
    goToNext,
    goToPrev,
    fetchPage,
    loadAll,
  };
}

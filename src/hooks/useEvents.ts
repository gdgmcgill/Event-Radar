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

interface UseEventsResult {
  events: Event[];
  loading: boolean;
  error: Error | null;
  total: number;
  nextCursor: string | null;
  prevCursor: string | null;
  refetch: () => void;
  goToNext: () => void;
  goToPrev: () => void;
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
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);

  // Stack for going back to previous pages
  const cursorStackRef = useRef<string[]>([]);

  // Track previous filters to reset cursor when they change
  const prevFiltersRef = useRef<string>("");

  const fetchEvents = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const queryString = buildQueryParams(filters, cursor, limit, sort, direction);
      const response = await fetch(`/api/events?${queryString}`);

      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await response.json();

      // Handle response format
      const eventList = Array.isArray(data) ? data : data.events || [];
      setEvents(eventList);
      setTotal(data.total || 0);
      setNextCursor(data.nextCursor ?? null);
      setPrevCursor(data.prevCursor ?? null);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch events"));
    } finally {
      setLoading(false);
    }
  }, [filters, enabled, cursor, limit, sort, direction]);

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

  return {
    events,
    loading,
    error,
    total,
    nextCursor,
    prevCursor,
    refetch: fetchEvents,
    goToNext,
    goToPrev,
  };
}

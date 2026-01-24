"use client";

/**
 * Custom hook for fetching and managing events with filtering support
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Event, EventFilter } from "@/types";

interface UseEventsOptions {
  filters?: EventFilter;
  enabled?: boolean;
  page?: number;
  limit?: number;
}

interface UseEventsResult {
  events: Event[];
  loading: boolean;
  error: Error | null;
  total: number;
  page: number;
  totalPages: number;
  refetch: () => void;
  setPage: (page: number) => void;
}

/**
 * Build query string from EventFilter
 */
function buildQueryParams(filters: EventFilter | undefined, page: number, limit: number): string {
  const params = new URLSearchParams();

  params.set("page", page.toString());
  params.set("limit", limit.toString());

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
  const { filters, enabled = true, page: initialPage = 1, limit = 50 } = options;

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);

  // Track previous filters to reset page when they change
  const prevFiltersRef = useRef<string>("");

  const fetchEvents = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const queryString = buildQueryParams(filters, page, limit);
      const response = await fetch(`/api/events?${queryString}`);

      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await response.json();

      // Handle response format
      const eventList = Array.isArray(data) ? data : data.events || [];
      setEvents(eventList);
      setTotal(data.total || eventList.length);
      setTotalPages(data.totalPages || Math.ceil((data.total || eventList.length) / limit));
    } catch (err) {
      console.error("Error fetching events:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch events"));
    } finally {
      setLoading(false);
    }
  }, [filters, enabled, page, limit]);

  // Reset page when filters change
  useEffect(() => {
    const filtersKey = JSON.stringify(filters || {});
    if (prevFiltersRef.current && prevFiltersRef.current !== filtersKey) {
      setPage(1);
    }
    prevFiltersRef.current = filtersKey;
  }, [filters]);

  // Fetch events when dependencies change
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    loading,
    error,
    total,
    page,
    totalPages,
    refetch: fetchEvents,
    setPage,
  };
}

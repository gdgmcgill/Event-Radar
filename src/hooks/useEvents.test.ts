import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useEvents } from "./useEvents";
import type { Event } from "@/types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockEvent = (id: string, date: string = "2026-02-25"): Event => ({
  id,
  title: `Event ${id}`,
  description: `Description for event ${id}`,
  event_date: date,
  event_time: "18:00",
  start_date: new Date(date).toISOString(),
  end_date: new Date(date).toISOString(),
  location: "Test Location",
  club_id: "club-1",
  tags: ["Academic"],
  image_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  status: "approved",
  club: {
    id: "club-1",
    name: "Test Club",
    instagram_handle: "@testclub",
    logo_url: null,
    description: "Test club description",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
});

const mockApiResponse = (
  events: Event[],
  total: number,
  nextCursor: string | null = null,
  prevCursor: string | null = null
) => ({
  ok: true,
  json: async () => ({
    events,
    total,
    nextCursor,
    prevCursor,
  }),
});

describe("useEvents Hook", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial Fetch", () => {
    it("should fetch events on mount", async () => {
      const events = [createMockEvent("1"), createMockEvent("2")];
      mockFetch.mockResolvedValueOnce(mockApiResponse(events, 2));

      const { result } = renderHook(() => useEvents());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.events).toEqual(events);
      expect(result.current.total).toBe(2);
      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should not fetch when enabled is false", async () => {
      const { result } = renderHook(() => useEvents({ enabled: false }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.events).toEqual([]);
    });

    it("should handle fetch errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useEvents());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("Network error");
      expect(result.current.events).toEqual([]);
    });
  });

  describe("Cursor-Based Pagination", () => {
    it("should fetch with nextCursor when goToNext is called", async () => {
      const page1Events = [createMockEvent("1"), createMockEvent("2")];
      const page2Events = [createMockEvent("3"), createMockEvent("4")];

      // First fetch
      mockFetch.mockResolvedValueOnce(
        mockApiResponse(page1Events, 4, "cursor-page-2")
      );

      const { result } = renderHook(() => useEvents());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.events).toEqual(page1Events);
      expect(result.current.nextCursor).toBe("cursor-page-2");

      // Navigate to next page
      mockFetch.mockResolvedValueOnce(
        mockApiResponse(page2Events, 4, null, "cursor-page-1")
      );

      act(() => {
        result.current.goToNext();
      });

      await waitFor(() => {
        expect(result.current.events).toEqual(page2Events);
      }, { timeout: 2000 });

      expect(result.current.nextCursor).toBeNull();
      expect(result.current.prevCursor).toBe("cursor-page-1");

      // Verify cursor was sent in request
      const lastCallUrl = mockFetch.mock.calls[1][0];
      expect(lastCallUrl).toContain("cursor=cursor-page-2");
    });

    it("should fetch with prevCursor when goToPrev is called", async () => {
      const page1Events = [createMockEvent("1"), createMockEvent("2")];
      const page2Events = [createMockEvent("3"), createMockEvent("4")];

      // Start on page 1
      mockFetch.mockResolvedValueOnce(
        mockApiResponse(page1Events, 4, "cursor-page-2")
      );

      const { result } = renderHook(() => useEvents());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.events[0].id).toBe("1");

      // Go to page 2
      mockFetch.mockResolvedValueOnce(
        mockApiResponse(page2Events, 4, null, "cursor-page-1")
      );

      act(() => {
        result.current.goToNext();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 2000 });

      await waitFor(() => {
        expect(result.current.events[0].id).toBe("3");
      }, { timeout: 2000 });

      // Now go back to page 1 using the cursor stack
      mockFetch.mockResolvedValueOnce(
        mockApiResponse(page1Events, 4, "cursor-page-2")
      );

      act(() => {
        result.current.goToPrev();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 2000 });

      await waitFor(() => {
        expect(result.current.events[0].id).toBe("1");
      }, { timeout: 2000 });
    });

    it("should not call goToNext when nextCursor is null", async () => {
      const events = [createMockEvent("1"), createMockEvent("2")];
      mockFetch.mockResolvedValueOnce(mockApiResponse(events, 2, null));

      const { result } = renderHook(() => useEvents());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const callCount = mockFetch.mock.calls.length;
      act(() => {
        result.current.goToNext();
      });

      // Should not trigger a new fetch
      expect(mockFetch).toHaveBeenCalledTimes(callCount);
    });
  });

  describe("Load More Functionality", () => {
    it("should append events when loadMore is called", async () => {
      const page1Events = [createMockEvent("1"), createMockEvent("2")];
      const page2Events = [createMockEvent("3"), createMockEvent("4")];

      // Initial fetch
      mockFetch.mockResolvedValueOnce(
        mockApiResponse(page1Events, 4, "cursor-next")
      );

      const { result } = renderHook(() => useEvents());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Load more
      mockFetch.mockResolvedValueOnce(
        mockApiResponse(page2Events, 4, null)
      );

      await act(async () => {
        await result.current.loadMore();
      });

      // Wait for loadingMore to be set and then complete
      await waitFor(() => {
        expect(result.current.loadingMore).toBe(false);
      });

      expect(result.current.events).toEqual([...page1Events, ...page2Events]);
      expect(result.current.nextCursor).toBeNull();
    });

    it("should not load more when already loading", async () => {
      const page1Events = [createMockEvent("1"), createMockEvent("2")];
      const page2Events = [createMockEvent("3"), createMockEvent("4")];
      
      mockFetch.mockResolvedValueOnce(
        mockApiResponse(page1Events, 4, "cursor-next")
      );

      const { result } = renderHook(() => useEvents());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.nextCursor).toBe("cursor-next");
      expect(result.current.loadingMore).toBe(false);
      
      const callCountBefore = mockFetch.mock.calls.length;

      // Mock a slow response
      let resolveLoadMore: any;
      const loadMorePromise = new Promise((resolve) => {
        resolveLoadMore = resolve;
      });
      
      mockFetch.mockImplementationOnce(() => loadMorePromise);
      
      // Start first load more
      act(() => {
        result.current.loadMore();
      });
      
      // Wait a tick for loadingMore to be set
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Now try to load more again (should be blocked because loadingMore is true)
      act(() => {
        result.current.loadMore();
        result.current.loadMore();
      });
      
      // Resolve the first load more
      await act(async () => {
        resolveLoadMore(mockApiResponse(page2Events, 4, null));
        await loadMorePromise;
      });

      // Wait for first load more to complete
      await waitFor(() => {
        expect(result.current.loadingMore).toBe(false);
      }, { timeout: 2000 });

      // Should only have made one additional call
      expect(mockFetch).toHaveBeenCalledTimes(callCountBefore + 1);
    });

    it("should not load more when nextCursor is null", async () => {
      const events = [createMockEvent("1"), createMockEvent("2")];
      mockFetch.mockResolvedValueOnce(mockApiResponse(events, 2, null));

      const { result } = renderHook(() => useEvents());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const callCount = mockFetch.mock.calls.length;
      act(() => {
        result.current.loadMore();
      });

      expect(mockFetch).toHaveBeenCalledTimes(callCount);
    });
  });

  describe("Load All Functionality", () => {
    it("should fetch all pages until no nextCursor", async () => {
      const page1 = [createMockEvent("1"), createMockEvent("2")];
      const page2 = [createMockEvent("3"), createMockEvent("4")];
      const page3 = [createMockEvent("5"), createMockEvent("6")];

      mockFetch.mockResolvedValueOnce(
        mockApiResponse(page1, 6, "cursor-2")
      );
      mockFetch.mockResolvedValueOnce(
        mockApiResponse(page2, 6, "cursor-3")
      );
      mockFetch.mockResolvedValueOnce(
        mockApiResponse(page3, 6, null)
      );

      const { result } = renderHook(() => useEvents({ enabled: false }));

      await act(async () => {
        await result.current.loadAll();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.events).toEqual([...page1, ...page2, ...page3]);
      expect(result.current.nextCursor).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should handle errors in loadAll", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Load all failed"));

      const { result } = renderHook(() => useEvents({ enabled: false }));

      await act(async () => {
        await result.current.loadAll();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("Load all failed");
    });

    it("should accept filters in loadAll options", async () => {
      const events = [createMockEvent("1")];
      mockFetch.mockResolvedValueOnce(mockApiResponse(events, 1, null));

      const { result } = renderHook(() => useEvents({ enabled: false }));

      await act(async () => {
        await result.current.loadAll({
          filters: {
            tags: ["Academic"],
            searchQuery: "test",
          },
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("tags=Academic");
      expect(callUrl).toContain("search=test");
    });
  });

  describe("Filters and Query Parameters", () => {
    it("should include filter parameters in request", async () => {
      const events = [createMockEvent("1")];
      mockFetch.mockResolvedValueOnce(mockApiResponse(events, 1));

      renderHook(() =>
        useEvents({
          filters: {
            tags: ["Academic", "Social"],
            searchQuery: "hackathon",
            dateRange: {
              start: new Date("2026-02-01"),
              end: new Date("2026-02-28"),
            },
            clubId: "club-123",
          },
          limit: 20,
          sort: "created_at",
          direction: "desc",
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("tags=Academic%2CSocial");
      expect(callUrl).toContain("search=hackathon");
      expect(callUrl).toContain("dateFrom=");
      expect(callUrl).toContain("dateTo=");
      expect(callUrl).toContain("clubId=club-123");
      expect(callUrl).toContain("limit=20");
      expect(callUrl).toContain("sort=created_at");
      expect(callUrl).toContain("direction=desc");
    });

    it("should reset cursor when filters change", async () => {
      const events1 = [createMockEvent("1")];
      const events2 = [createMockEvent("2")];

      mockFetch.mockResolvedValueOnce(
        mockApiResponse(events1, 1, "cursor-next")
      );

      const { result, rerender } = renderHook(
        ({ filters }) => useEvents({ filters }),
        {
          initialProps: { filters: { tags: ["Academic"] } },
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.nextCursor).toBe("cursor-next");

      // Change filters
      mockFetch.mockResolvedValueOnce(mockApiResponse(events2, 1, null));

      rerender({ filters: { tags: ["Social"] } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      // Cursor should be reset (no cursor in URL)
      const secondCallUrl = mockFetch.mock.calls[1][0];
      expect(secondCallUrl).not.toContain("cursor=");
    });
  });

  describe("Refetch Functionality", () => {
    it("should refetch current page when refetch is called", async () => {
      const events1 = [createMockEvent("1")];
      const events2 = [createMockEvent("1"), createMockEvent("2")];

      mockFetch.mockResolvedValueOnce(mockApiResponse(events1, 1));

      const { result } = renderHook(() => useEvents());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Refetch
      mockFetch.mockResolvedValueOnce(mockApiResponse(events2, 2));

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.events).toEqual(events2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("FetchPage Method", () => {
    it("should allow custom fetchPage calls", async () => {
      const events = [createMockEvent("1")];
      mockFetch.mockResolvedValueOnce(mockApiResponse(events, 1));

      const { result } = renderHook(() => useEvents({ enabled: false }));

      const response = await result.current.fetchPage({
        filters: { tags: ["Sports"] },
        limit: 10,
      });

      expect(response.events).toEqual(events);
      expect(response.total).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should handle API errors in fetchPage", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "API error" }),
      });

      const { result } = renderHook(() => useEvents({ enabled: false }));

      await expect(result.current.fetchPage()).rejects.toThrow(
        "Failed to fetch events"
      );
    });

    it("should include clubId when provided in fetchPage filters", async () => {
      const events = [createMockEvent("1")];
      mockFetch.mockResolvedValueOnce(mockApiResponse(events, 1));

      const { result } = renderHook(() => useEvents({ enabled: false }));

      await result.current.fetchPage({ filters: { clubId: "club-456" } });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("clubId=club-456");
    });
  });

  describe("Sort Options", () => {
    it("should support different sort fields", async () => {
      const events = [createMockEvent("1")];

      // Test popularity_score
      mockFetch.mockResolvedValueOnce(mockApiResponse(events, 1));
      const { result: result1 } = renderHook(() =>
        useEvents({ sort: "popularity_score", direction: "desc" })
      );

      await waitFor(() => {
        expect(result1.current.loading).toBe(false);
      });

      expect(mockFetch.mock.calls[0][0]).toContain("sort=popularity_score");
      expect(mockFetch.mock.calls[0][0]).toContain("direction=desc");

      mockFetch.mockClear();

      // Test trending_score
      mockFetch.mockResolvedValueOnce(mockApiResponse(events, 1));
      const { result: result2 } = renderHook(() =>
        useEvents({ sort: "trending_score", direction: "asc" })
      );

      await waitFor(() => {
        expect(result2.current.loading).toBe(false);
      });

      expect(mockFetch.mock.calls[0][0]).toContain("sort=trending_score");
      expect(mockFetch.mock.calls[0][0]).toContain("direction=asc");
    });
  });

  describe("Cursor Stack History", () => {
    it("should maintain cursor history for backward navigation", async () => {
      const page1Events = [createMockEvent("1")];
      const page2Events = [createMockEvent("2")];
      const page3Events = [createMockEvent("3")];

      // Page 1
      mockFetch.mockResolvedValueOnce(
        mockApiResponse(page1Events, 3, "cursor-2")
      );

      const { result } = renderHook(() => useEvents());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.events[0].id).toBe("1");

      // Page 2
      mockFetch.mockResolvedValueOnce(
        mockApiResponse(page2Events, 3, "cursor-3", "cursor-1")
      );
      act(() => {
        result.current.goToNext();
      });

      await waitFor(() => { 
        expect(result.current.loading).toBe(false);
      }, { timeout: 2000 });
      
      await waitFor(() => {
        expect(result.current.events[0].id).toBe("2");
      }, { timeout: 2000 });

      // Page 3
      mockFetch.mockResolvedValueOnce(
        mockApiResponse(page3Events, 3, null, "cursor-2")
      );
      act(() => {
        result.current.goToNext();
      });

      await waitFor(() => {
        expect(result.current.events[0].id).toBe("3");
      }, { timeout: 2000 });

      // Go back to page 2 - the cursor stack should restore cursor-2
      mockFetch.mockResolvedValueOnce(
        mockApiResponse(page2Events, 3, "cursor-3", "cursor-1")
      );
      act(() => {
        result.current.goToPrev();
      });

      await waitFor(() => {
        expect(result.current.events[0].id).toBe("2");
      }, { timeout: 2000 });

      // Go back to page 1
      mockFetch.mockResolvedValueOnce(
        mockApiResponse(page1Events, 3, "cursor-2")
      );
      act(() => {
        result.current.goToPrev();
      });

      await waitFor(() => {
        expect(result.current.events[0].id).toBe("1");
      }, { timeout: 2000 });
    });
  });
});

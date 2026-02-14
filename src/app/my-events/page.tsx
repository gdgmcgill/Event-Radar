"use client";

/**
 * My Events page - Display user's saved events
 * Supports auth gating, unsaving events, and sorting.
 */

import { useState, useEffect, useCallback } from "react";
import { EventGrid } from "@/components/events/EventGrid";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/auth/SignInButton";
import {
  Calendar,
  Heart,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
import type { Event } from "@/types";
import Link from "next/link";

type SortOption = "recent" | "date" | "title";

const SORT_LABELS: Record<SortOption, string> = {
  recent: "Recently Saved",
  date: "Event Date",
  title: "Title A-Z",
};

export default function MyEventsPage() {
  const { user, loading: authLoading } = useAuthStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [savedEventIds, setSavedEventIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>("recent");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const fetchSavedEvents = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/users/saved-events?sort=${sort}`);
      if (!response.ok) {
        throw new Error("Failed to fetch saved events");
      }

      const data = await response.json();
      setEvents(data.events || []);
      setSavedEventIds(new Set(data.savedEventIds || []));
    } catch (err) {
      console.error("Error fetching saved events:", err);
      setError("Failed to load saved events. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user, sort]);

  useEffect(() => {
    if (user) {
      fetchSavedEvents();
    }
  }, [user, fetchSavedEvents]);

  const handleUnsave = async (eventId: string) => {
    if (!user) return;

    // Optimistic UI: remove immediately
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    setSavedEventIds((prev) => {
      const next = new Set(prev);
      next.delete(eventId);
      return next;
    });

    try {
      const response = await fetch(`/api/events/${eventId}/save`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });

      if (!response.ok) {
        // Revert on failure
        fetchSavedEvents();
        console.error("Failed to unsave event");
      }
    } catch (err) {
      // Revert on error
      fetchSavedEvents();
      console.error("Error unsaving event:", err);
    }
  };

  // Loading auth state
  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            My Events
          </h1>
          <p className="text-muted-foreground">Events you&apos;ve saved for later</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            My Events
          </h1>
          <p className="text-muted-foreground">Events you&apos;ve saved for later</p>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            Sign in to save and view your events
          </p>
          <SignInButton />
        </div>
      </div>
    );
  }

  // Signed in — show saved events
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            My Events
          </h1>
          <p className="text-muted-foreground">Events you&apos;ve saved for later</p>
        </div>

        {/* Sort dropdown */}
        {events.length > 0 && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-2"
            >
              <ArrowUpDown className="h-4 w-4" />
              {SORT_LABELS[sort]}
            </Button>
            {showSortMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-md bg-card border shadow-lg z-10">
                {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setSort(option);
                      setShowSortMenu(false);
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-secondary/50 transition-colors ${
                      sort === option
                        ? "font-semibold text-primary"
                        : "text-foreground"
                    }`}
                  >
                    {SORT_LABELS[option]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={fetchSavedEvents} variant="outline">
            Try Again
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && <EventGrid events={[]} loading={true} />}

      {/* Empty state */}
      {!loading && !error && events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
          <Heart className="h-16 w-16 text-muted-foreground/30 mb-6" />
          <p className="text-xl font-semibold mb-2 text-foreground">
            No saved events yet
          </p>
          <p className="text-base text-muted-foreground max-w-md mb-6">
            Start exploring events and tap the heart icon to save them here for
            later.
          </p>
          <Link href="/">
            <Button>Discover Events</Button>
          </Link>
        </div>
      )}

      {/* Events grid */}
      {!loading && !error && events.length > 0 && (
        <EventGrid
          events={events}
          showSaveButton={true}
          savedEventIds={savedEventIds}
          onUnsave={handleUnsave}
          onEventClick={undefined}
          trackingSource="home"
        />
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import type { Event, EventTag } from "@/types";
import { EVENT_TAGS } from "@/lib/constants";
import { useAuthStore } from "@/store/useAuthStore";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { CategorySection, CategorySectionSkeleton } from "@/components/events/CategorySection";
import { EventDetailsModal } from "@/components/events/EventDetailsModal";
import { AlertCircle, RefreshCcw, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CategoriesPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const { savedEventIds } = useSavedEvents(!!user);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/events?limit=200");
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError("Failed to load events. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Group events by tag - an event can appear in multiple categories
  const eventsByTag = useMemo(() => {
    const grouped: Record<string, Event[]> = {};
    for (const tag of EVENT_TAGS) {
      grouped[tag] = events.filter((e) => e.tags.includes(tag));
    }
    return grouped;
  }, [events]);

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
            <Button onClick={fetchEvents} variant="outline" className="gap-2">
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

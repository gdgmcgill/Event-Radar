"use client";

import { useState, useEffect } from "react";
import { type Event, EventTag } from "@/types";
import { EventCard } from "@/components/events/EventCard";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";
import { useSavedEvents } from "@/hooks/useSavedEvents";

interface PopularEventsSectionProps {
  onEventClick?: (event: Event) => void;
}

export function PopularEventsSection({ onEventClick }: PopularEventsSectionProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);
  const { savedEventIds } = useSavedEvents(!!user);

  const fetchPopularEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/events/popular?sort=popularity&limit=6");
      if (!res.ok) throw new Error("Failed to fetch popular events");
      const data = await res.json();
      
      const evt = Array.isArray(data.events) ? (data.events as Event[]) : [];
      
      // Inject dummy events for UI testing
      const dummyEvents: Event[] = [
        {
          id: "dummy-1",
          title: "McGill Robotics Showcase",
          description: "Come see our fully autonomous mars rover prototype.",
          event_date: "2026-03-12",
          event_time: "14:00",
          location: "McConnell Engineering",
          club_id: "McGill Robotics",
          tags: [EventTag.ACADEMIC, EventTag.CAREER],
          image_url: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=800",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: "approved",
          approved_by: null,
          approved_at: null,
          club: {
            id: "McGill Robotics",
            name: "McGill Robotics",
            instagram_handle: "mcgillrobotics",
            logo_url: null,
            description: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          saved_by_users: []
        },
        {
          id: "dummy-2",
          title: "Spring Formal Gala",
          description: "Annual spring formal event for all students. Dress to impress!",
          event_date: "2026-05-01",
          event_time: "19:00",
          location: "Le Centre Sheraton",
          club_id: "SSMU",
          tags: [EventTag.SOCIAL, EventTag.CULTURAL],
          image_url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: "approved",
          approved_by: null,
          approved_at: null,
          club: {
            id: "SSMU",
            name: "SSMU",
            instagram_handle: "ssmu_events",
            logo_url: null,
            description: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          saved_by_users: []
        },
        {
          id: "dummy-3",
          title: "Beginner Yoga Session",
          description: "De-stress before midterms with a friendly yoga session.",
          event_date: "2026-02-28",
          event_time: "10:00",
          location: "SSMU Studio",
          club_id: "Yoga Club",
          tags: [EventTag.WELLNESS, EventTag.SPORTS],
          image_url: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=800",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: "approved",
          approved_by: null,
          approved_at: null,
          club: {
            id: "Yoga Club",
            name: "Yoga Club",
            instagram_handle: "mcgillyoga",
            logo_url: null,
            description: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          saved_by_users: []
        }
      ];

      setEvents([...evt, ...dummyEvents]);
    } catch (err) {
      console.error("Error fetching popular events:", err);
      setError("Failed to load popular events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPopularEvents();
  }, []);

  if (loading && events.length === 0) {
    return (
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-foreground tracking-tight mb-6">Popular This Week</h2>
        <div className="flex overflow-x-auto gap-6 sm:grid sm:grid-cols-2 lg:grid-cols-3 snap-x snap-mandatory pb-4">
          {[1, 2, 3].map((i) => (
             <div key={i} className="min-w-[280px] w-[85vw] sm:w-auto sm:min-w-0 snap-center h-[380px] rounded-2xl bg-secondary/20 animate-pulse border border-border/40" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-12 flex flex-col items-center justify-center py-10 text-center space-y-4 bg-card rounded-2xl border border-destructive/20 p-6">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchPopularEvents} variant="outline" size="sm" className="gap-2">
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
    <div className="mb-12">
      <h2 className="text-3xl font-bold text-foreground tracking-tight mb-6">Popular This Week</h2>
      
      {/* Mobile: Horizontal snap scroll. Desktop: Grid */}
      <div className="flex overflow-x-auto gap-6 sm:grid sm:grid-cols-2 lg:grid-cols-3 snap-x snap-mandatory pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
        {events.map((event) => (
          <div key={event.id} className="min-w-[280px] w-[85vw] sm:w-auto sm:min-w-0 snap-center">
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
    </div>
  );
}

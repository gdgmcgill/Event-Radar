"use client";

/**
 * Home page - Main event calendar/browse view
 * NOTE: Currently uses mock events until Supabase integration is ready.
 */

import { useState } from "react";
import type { Event } from "@/types";
import { EventTag } from "@/types";

import { EventSearch } from "@/components/events/EventSearch";
import { EventFilters } from "@/components/events/EventFilters";
import { EventGrid } from "@/components/events/EventGrid";
import { EventDetailsModal } from "@/components/events/EventDetailsModal";

// Temporary mock data so we can build and test the UI without Supabase
const mockEvents: Event[] = [
  {
    id: "1",
    title: "GDG McGill Kickoff",
    description: "Come meet the Uni-Verse team, learn about the project, and grab some pizza.",
    event_date: "2025-11-25",
    event_time: "18:00",
    location: "McConnell Engineering Building, Room 437",
    club_id: "club_1",
    tags: [EventTag.SOCIAL],          // ✅ enum value, not string
    image_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "approved",
    approved_by: null,
    approved_at: null,
    club: {
      id: "club_1",
      name: "GDG McGill",
      instagram_handle: "gdgmcgill",
      logo_url: null,
      description: "Google Developer Group at McGill University",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    saved_by_users: [],
  },
];

export default function HomePage() {
  const [events] = useState<Event[]>(mockEvents);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Discover Campus Events</h1>
        <p className="text-muted-foreground">
          Explore events happening at McGill University
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <EventSearch />
          </div>
          {/* TODO: Add view toggle (grid/calendar) */}
        </div>
        <EventFilters />
      </div>

      {/* Events Grid */}
      <EventGrid
        events={events}
        loading={false}
        onEventClick={handleEventClick}
      />

      {/* Event Details Modal */}
      <EventDetailsModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setSelectedEvent(null);
        }}
        event={selectedEvent}
      />
    </div>
  );
}

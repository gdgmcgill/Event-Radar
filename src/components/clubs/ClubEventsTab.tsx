"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, CalendarX2, MapPin } from "lucide-react";
import type { Event } from "@/types";
import { formatDate, formatTime } from "@/lib/utils";

interface ClubEventsTabProps {
  clubId: string;
}

export function ClubEventsTab({ clubId }: ClubEventsTabProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/events`);
      if (!res.ok) throw new Error("Failed to load events");
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch {
      setError("Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function getStatusBadge(status: Event["status"]) {
    if (status === "approved") {
      return (
        <Badge
          variant="default"
          className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
        >
          Approved
        </Badge>
      );
    }
    if (status === "pending") {
      return (
        <Badge
          variant="secondary"
          className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
        >
          Pending
        </Badge>
      );
    }
    return <Badge variant="destructive">Rejected</Badge>;
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-foreground">Events</h2>
        <Link href={`/create-event?clubId=${clubId}`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </Link>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span>Loading events...</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <p className="text-destructive font-medium">{error}</p>
          <Button variant="outline" onClick={fetchEvents}>
            Try Again
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <CalendarX2 className="h-12 w-12 text-muted-foreground/50" />
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              No events yet
            </h3>
            <p className="text-muted-foreground text-sm">
              Create your first event for this club.
            </p>
          </div>
          <Link href={`/create-event?clubId=${clubId}`}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </Link>
        </div>
      )}

      {/* Events list */}
      {!loading && !error && events.length > 0 && (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <Link
                  href={`/events/${event.id}`}
                  className="font-semibold text-foreground hover:text-primary truncate"
                >
                  {event.title}
                </Link>
                <span className="text-sm text-muted-foreground">
                  {formatDate(event.event_date)} &middot;{" "}
                  {formatTime(event.event_time)}
                </span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{event.location}</span>
                </span>
              </div>
              <div className="ml-4 shrink-0">{getStatusBadge(event.status)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

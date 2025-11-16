// src/components/events/EventDetailsModal.tsx
"use client";

import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Event } from "@/types";

type EventDetailsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event | null;
};

export function EventDetailsModal({ open, onOpenChange, event }: EventDetailsModalProps) {
  if (!event) return null;

  const dateTimeString = `${format(new Date(event.event_date), "EEE, MMM d")} • ${event.event_time}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    event.location,
  )}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription>
            {dateTimeString} • {event.location}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4 text-sm">
          {event.description && <p>{event.description}</p>}

          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center underline"
          >
            Open in Google Maps
          </a>

          {event.tags && event.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {event.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-3 py-1 text-xs capitalize"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {event.club && (
            <div className="pt-2 border-t text-xs text-muted-foreground">
              Hosted by {event.club.name}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

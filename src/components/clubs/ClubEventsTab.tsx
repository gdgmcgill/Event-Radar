"use client";

import { useState } from "react";
import { useClubEventsManagement } from "@/hooks/useClubs";
import { CreateEventModal } from "@/components/events/CreateEventModal";
import { CreateEventForm } from "@/components/events/CreateEventForm";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { Plus, Calendar, Users, Star, CalendarX, Pencil, Copy } from "lucide-react";
import type { EventTag } from "@/types";

interface ClubEventsTabProps {
  clubId: string;
  clubName: string;
}

interface EventWithRsvp {
  id: string;
  title: string;
  description: string;
  start_date: string;
  location: string;
  tags: EventTag[];
  image_url?: string | null;
  category?: string | null;
  status: "pending" | "approved" | "rejected";
  rsvp_counts?: {
    going: number;
    interested: number;
  };
}

const statusConfig = {
  approved: {
    label: "Approved",
    variant: "default" as const,
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
  },
  pending: {
    label: "Pending",
    variant: "secondary" as const,
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  },
  rejected: {
    label: "Rejected",
    variant: "destructive" as const,
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  },
};

export function ClubEventsTab({ clubId, clubName }: ClubEventsTabProps) {
  const { events, isLoading, mutate } = useClubEventsManagement(clubId);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithRsvp | null>(null);
  const [duplicatingEvent, setDuplicatingEvent] = useState<EventWithRsvp | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Events</h2>
        <Button
          onClick={() => setCreateOpen(true)}
          size="sm"
          className="gap-1.5 rounded-xl cursor-pointer"
          aria-label="Create a new event"
        >
          <Plus className="h-4 w-4" />
          Create Event
        </Button>
      </div>

      {/* Event List */}
      {events.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center rounded-xl border-dashed">
          <CalendarX className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground font-medium">No events yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Create your first event!
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {(events as EventWithRsvp[]).map((event) => {
            const config = statusConfig[event.status];
            const rsvp = event.rsvp_counts;

            return (
              <Card
                key={event.id}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground truncate">
                      {event.title}
                    </h3>
                    <Badge
                      variant={config.variant}
                      className={config.className}
                    >
                      {config.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(event.start_date)}
                    </span>
                    {rsvp && (
                      <>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {rsvp.going} going
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5" />
                          {rsvp.interested} interested
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer"
                    aria-label="Edit event"
                    onClick={() => setEditingEvent(event)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer"
                    aria-label="Duplicate event"
                    onClick={() => setDuplicatingEvent(event)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Event Modal */}
      <CreateEventModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        clubId={clubId}
        onSuccess={() => mutate()}
      />

      {/* Edit Event Modal */}
      <Dialog
        open={!!editingEvent}
        onOpenChange={(open) => {
          if (!open) setEditingEvent(null);
        }}
      >
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>
              Update the details of your event.
            </DialogDescription>
          </DialogHeader>
          {editingEvent && (
            <CreateEventForm
              clubId={clubId}
              eventId={editingEvent.id}
              mode="edit"
              initialData={{
                title: editingEvent.title,
                description: editingEvent.description,
                start_date: editingEvent.start_date,
                location: editingEvent.location,
                tags: editingEvent.tags,
                image_url: editingEvent.image_url,
                category: editingEvent.category,
              }}
              onSuccess={() => {
                setEditingEvent(null);
                mutate();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate Event Modal */}
      <Dialog
        open={!!duplicatingEvent}
        onOpenChange={(open) => {
          if (!open) setDuplicatingEvent(null);
        }}
      >
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Duplicate Event</DialogTitle>
            <DialogDescription>
              Create a new event based on an existing one. Pick a new date and time.
            </DialogDescription>
          </DialogHeader>
          {duplicatingEvent && (
            <CreateEventForm
              clubId={clubId}
              mode="duplicate"
              initialData={{
                title: duplicatingEvent.title,
                description: duplicatingEvent.description,
                location: duplicatingEvent.location,
                tags: duplicatingEvent.tags,
                image_url: duplicatingEvent.image_url,
                category: duplicatingEvent.category,
              }}
              onSuccess={() => {
                setDuplicatingEvent(null);
                mutate();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

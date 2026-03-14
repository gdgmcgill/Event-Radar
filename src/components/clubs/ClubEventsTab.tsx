"use client";

import { useState } from "react";
import { useClubEventsManagement } from "@/hooks/useClubs";
import { CreateEventModal } from "@/components/events/CreateEventModal";
import { CreateEventForm } from "@/components/events/CreateEventForm";
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
import {
  Plus,
  Calendar,
  CalendarX,
  Pencil,
  Copy,
  Eye,
  Trash2,
  Users,
  TrendingDown,
} from "lucide-react";
import type { EventTag } from "@/types";

interface ClubEventsTabProps {
  clubId: string;
  clubName: string;
}

interface EventWithRsvp {
  id: string;
  title: string;
  description: string;
  event_date: string;
  location: string;
  tags: EventTag[];
  image_url?: string | null;
  category?: string | null;
  status: "pending" | "approved" | "rejected";
  rsvp_counts?: {
    going: number;
    interested: number;
    cancelled: number;
  };
}

type DisplayStatus = "published" | "pending" | "rejected" | "past";

const getDisplayStatus = (event: EventWithRsvp): DisplayStatus => {
  const eventDate = new Date(event.event_date);
  const now = new Date();
  if (eventDate < now) return "past";
  if (event.status === "approved") return "published";
  if (event.status === "rejected") return "rejected";
  return "pending";
};

const statusBadgeConfig: Record<DisplayStatus, string> = {
  published:
    "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  pending:
    "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  rejected:
    "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  past: "bg-muted text-muted-foreground border border-border",
};

export function ClubEventsTab({ clubId, clubName }: ClubEventsTabProps) {
  const { events, isLoading, mutate } = useClubEventsManagement(clubId);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithRsvp | null>(null);
  const [duplicatingEvent, setDuplicatingEvent] =
    useState<EventWithRsvp | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (eventId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this event? This action cannot be undone."
    );
    if (!confirmed) return;

    setDeletingId(eventId);
    try {
      // TODO: Wire up when DELETE /api/events/[id] endpoint is implemented
      // const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      // if (!res.ok) throw new Error("Failed to delete event");
      // mutate();
      console.warn(
        "Delete endpoint not yet implemented for event:",
        eventId
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-bold text-foreground">All Events</h4>
        <button
          onClick={() => setCreateOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all duration-200 active:scale-95 shadow-lg shadow-red-600/20 hover:shadow-red-600/30"
        >
          <Plus className="h-4 w-4" />
          <span>Create Event</span>
        </button>
      </div>

      {/* Events Table */}
      {events.length === 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col items-center justify-center py-16 text-center">
          <CalendarX className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-foreground font-medium">No events yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Create your first event to start building your audience.
          </p>
          <Button
            onClick={() => setCreateOpen(true)}
            className="mt-4 bg-red-600 hover:bg-red-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">
                  Event Name
                </th>
                <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs text-center">
                  Status
                </th>
                <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">
                  Date
                </th>
                <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs text-center">
                  RSVPs
                </th>
                <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(events as EventWithRsvp[]).map((event) => {
                const displayStatus = getDisplayStatus(event);
                const rsvp = event.rsvp_counts;
                const totalActive = rsvp
                  ? rsvp.going + rsvp.interested
                  : 0;
                const cancelled = rsvp?.cancelled ?? 0;
                const totalAll = totalActive + cancelled;
                const churnPct =
                  totalAll > 0
                    ? Math.round((cancelled / totalAll) * 100)
                    : 0;

                return (
                  <tr
                    key={event.id}
                    className="hover:bg-muted/30 transition-colors duration-150"
                  >
                    {/* Event Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-red-600/10 dark:bg-red-600/20 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <span className="font-semibold text-foreground">
                          {event.title}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusBadgeConfig[displayStatus]}`}
                      >
                        {displayStatus}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 text-muted-foreground">
                      {formatDate(event.event_date)}
                    </td>

                    {/* RSVPs Breakdown */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap justify-center">
                          {/* Going */}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <Users className="h-3 w-3" />
                            {rsvp?.going ?? 0}
                          </span>
                          {/* Interested */}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            {rsvp?.interested ?? 0}
                          </span>
                          {/* Cancelled */}
                          {cancelled > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
                              {cancelled}
                            </span>
                          )}
                        </div>
                        {/* Churn indicator */}
                        {cancelled > 0 && churnPct > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <TrendingDown className="h-3 w-3" />
                            {churnPct}% drop-off
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right space-x-1">
                      {displayStatus === "past" ? (
                        <button className="p-1.5 hover:text-red-600 transition-colors duration-150 text-muted-foreground rounded hover:bg-red-600/5 dark:hover:bg-red-600/10">
                          <Eye className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          className="p-1.5 hover:text-red-600 transition-colors duration-150 text-muted-foreground rounded hover:bg-red-600/5 dark:hover:bg-red-600/10"
                          onClick={() => setEditingEvent(event)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        className="p-1.5 hover:text-red-600 transition-colors duration-150 text-muted-foreground rounded hover:bg-red-600/5 dark:hover:bg-red-600/10"
                        onClick={() => setDuplicatingEvent(event)}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        className="p-1.5 hover:text-red-600 transition-colors duration-150 text-muted-foreground rounded hover:bg-red-600/5 dark:hover:bg-red-600/10 disabled:opacity-40"
                        onClick={() => handleDelete(event.id)}
                        disabled={deletingId === event.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
                start_date: editingEvent.event_date,
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
              Create a new event based on an existing one. Pick a new date and
              time.
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

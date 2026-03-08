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
  BarChart3,
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

const getDisplayStatus = (event: EventWithRsvp): "published" | "draft" | "past" => {
  const eventDate = new Date(event.start_date);
  const now = new Date();
  if (eventDate < now) return "past";
  if (event.status === "approved") return "published";
  return "draft";
};

const statusBadgeConfig = {
  published: "bg-green-100 text-green-700 border border-green-200",
  draft: "bg-slate-100 text-slate-600 border border-slate-200",
  past: "bg-red-600/10 text-red-600 border border-red-600/20",
};

export function ClubEventsTab({ clubId, clubName }: ClubEventsTabProps) {
  const { events, isLoading, mutate } = useClubEventsManagement(clubId);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithRsvp | null>(null);
  const [duplicatingEvent, setDuplicatingEvent] = useState<EventWithRsvp | null>(null);

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
        <h4 className="text-lg font-bold">All Events</h4>
        <button
          onClick={() => setCreateOpen(true)}
          className="bg-red-600 hover:bg-red-600/90 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-red-600/20"
        >
          <Plus className="h-4 w-4" />
          <span>Create Event</span>
        </button>
      </div>

      {/* Events Table */}
      {events.length === 0 ? (
        <div className="bg-white rounded-xl border border-red-600/5 shadow-sm flex flex-col items-center justify-center py-16 text-center">
          <CalendarX className="h-10 w-10 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No events yet</p>
          <p className="text-sm text-slate-400 mt-1">Create your first event!</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-red-600/5 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-red-600/5">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Event Name</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-center">Status</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Date</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-center">RSVPs</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-600/5">
              {(events as EventWithRsvp[]).map((event) => {
                const displayStatus = getDisplayStatus(event);
                const rsvp = event.rsvp_counts;

                return (
                  <tr key={event.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-red-600/10 flex items-center justify-center text-red-600 shrink-0">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <span className="font-semibold">{event.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusBadgeConfig[displayStatus]}`}>
                        {displayStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{formatDate(event.start_date)}</td>
                    <td className="px-6 py-4 text-center text-slate-500">
                      {rsvp ? rsvp.going + rsvp.interested : 0}
                    </td>
                    <td className="px-6 py-4 text-right space-x-1">
                      {displayStatus === "past" ? (
                        <button className="p-1.5 hover:text-red-600 transition-colors text-slate-400 rounded hover:bg-red-600/5">
                          <Eye className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          className="p-1.5 hover:text-red-600 transition-colors text-slate-400 rounded hover:bg-red-600/5"
                          onClick={() => setEditingEvent(event)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        className="p-1.5 hover:text-red-600 transition-colors text-slate-400 rounded hover:bg-red-600/5"
                        onClick={() => setDuplicatingEvent(event)}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button className="p-1.5 hover:text-red-600 transition-colors text-slate-400 rounded hover:bg-red-600/5">
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

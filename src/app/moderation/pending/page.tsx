"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  XCircle,
  Calendar,
  MapPin,
  Pencil,
  Star,
  CheckCircle2,
  Tag,
  User,
  Loader2,
} from "lucide-react";
import { FeatureEventModal } from "@/components/moderation/FeatureEventModal";

interface PendingEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  location: string | null;
  organizer: string | null;
  tags: string[] | null;
  status: string;
  created_at: string | null;
  image_url: string | null;
}

export default function ModerationPendingEventsPage() {
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<PendingEvent | null>(null);
  const [editForm, setEditForm] = useState<Partial<PendingEvent>>({});
  const [featuringEvent, setFeaturingEvent] = useState<PendingEvent | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; status: "approved" | "rejected" } | null>(null);

  const fetchPending = useCallback(async () => {
    setConfirmAction(null);
    const supabase = createClient();
    const { data } = await supabase
      .from("events")
      .select("id, title, description, start_date, end_date, location, organizer, tags, status, created_at, image_url")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    setEvents(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleAction = async (eventId: string, status: "approved" | "rejected") => {
    setConfirmAction(null);
    setActionLoading(eventId);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
      }
    } finally {
      setActionLoading(null);
    }
  };

  const openEdit = (event: PendingEvent) => {
    setEditingEvent(event);
    setEditForm({
      title: event.title,
      description: event.description,
      start_date: event.start_date,
      end_date: event.end_date,
      location: event.location,
      organizer: event.organizer,
      tags: event.tags,
    });
  };

  const saveEdit = async () => {
    if (!editingEvent) return;
    setActionLoading(editingEvent.id);
    try {
      const res = await fetch(`/api/admin/events/${editingEvent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === editingEvent.id ? { ...e, ...editForm } : e
          )
        );
        setEditingEvent(null);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const saveAndApprove = async () => {
    if (!editingEvent) return;
    setActionLoading(editingEvent.id);
    try {
      await fetch(`/api/admin/events/${editingEvent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const res = await fetch(`/api/admin/events/${editingEvent.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== editingEvent.id));
        setEditingEvent(null);
      }
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Pending Review
          </h2>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden animate-pulse"
            >
              <div className="w-48 shrink-0 bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex-1 p-4 space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3 w-1/4 rounded bg-zinc-100 dark:bg-zinc-800/60" />
                </div>
                <div className="h-3 w-2/3 rounded bg-zinc-100 dark:bg-zinc-800/60" />
                <div className="flex gap-2 pt-1">
                  <div className="h-5 w-12 rounded bg-zinc-100 dark:bg-zinc-800/60" />
                  <div className="h-5 w-12 rounded bg-zinc-100 dark:bg-zinc-800/60" />
                  <div className="ml-auto flex gap-1.5">
                    <div className="h-7 w-16 rounded bg-zinc-100 dark:bg-zinc-800/60" />
                    <div className="h-7 w-16 rounded bg-zinc-100 dark:bg-zinc-800/60" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Pending Review
        </h2>
        <Badge className="bg-amber-500 text-white hover:bg-amber-500">
          {events.length}
        </Badge>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-500">
            <CheckCircle2 className="h-10 w-10 mb-3 stroke-[1.5] text-emerald-400" />
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              No pending events — you&apos;re all caught up!
            </p>
            <p className="text-xs mt-1">
              New submissions will appear here for review.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden transition-shadow hover:shadow-lg dark:hover:shadow-zinc-900/50"
            >
              {/* Image */}
              <div className="relative w-48 shrink-0">
                <Image
                  src={event.image_url || "/placeholder-event.png"}
                  alt={event.title}
                  fill
                  className="object-cover"
                />
                {/* Gradient fade into content */}
                <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white dark:from-zinc-900 to-transparent" />
                {/* Date badge */}
                <div className="absolute bottom-2.5 left-2.5 flex flex-col items-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-0.5 shadow-sm">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-primary">
                    {new Date(event.start_date).toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="text-base font-extrabold leading-none text-zinc-900 dark:text-zinc-100">
                    {new Date(event.start_date).getDate()}
                  </span>
                </div>
                {/* Pending badge */}
                <div className="absolute top-2.5 right-2.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    Pending
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col p-4 min-w-0">
                {/* Top row: title + organizer + meta */}
                <div className="flex items-start justify-between gap-4 mb-1.5">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {event.title}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <User className="h-3 w-3 shrink-0" />
                      <span>{event.organizer ?? "Unknown organizer"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(event.start_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      {event.end_date && ` — ${new Date(event.end_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {event.location}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description — single line */}
                {event.description && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1 mb-2">
                    {event.description}
                  </p>
                )}

                {/* Tags + Actions on one row */}
                <div className="flex items-center gap-3 mt-auto pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  {/* Tags */}
                  {event.tags && event.tags.length > 0 && (
                    <div className="flex items-center gap-1 mr-auto">
                      {event.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                  {confirmAction?.id === event.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">
                        {confirmAction.status === "approved" ? "Approve?" : "Reject?"}
                      </span>
                      <button
                        onClick={() => handleAction(event.id, confirmAction.status)}
                        disabled={actionLoading === event.id}
                        className="inline-flex items-center justify-center h-8 px-3 text-xs font-medium rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === event.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Yes"
                        )}
                      </button>
                      <button
                        onClick={() => setConfirmAction(null)}
                        className="inline-flex items-center justify-center h-8 px-3 text-xs font-medium rounded-md text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setConfirmAction({ id: event.id, status: "approved" })}
                        disabled={actionLoading === event.id}
                        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => setConfirmAction({ id: event.id, status: "rejected" })}
                        disabled={actionLoading === event.id}
                        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => openEdit(event)}
                    disabled={actionLoading === event.id}
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => setFeaturingEvent(event)}
                    disabled={actionLoading === event.id || event.status !== "approved"}
                    title={event.status !== "approved" ? "Approve the event first" : "Feature this event"}
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Star className="h-3.5 w-3.5" />
                    Feature
                  </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {featuringEvent && (
        <FeatureEventModal
          open={!!featuringEvent}
          onOpenChange={(open) => !open && setFeaturingEvent(null)}
          eventId={featuringEvent.id}
          eventTitle={featuringEvent.title}
          onSubmit={() => setFeaturingEvent(null)}
        />
      )}

      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent className="max-w-lg border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-100">
              Edit Event
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Title
              </label>
              <Input
                value={editForm.title ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Description
              </label>
              <Textarea
                value={editForm.description ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={4}
                className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Start Date
                </label>
                <Input
                  type="datetime-local"
                  value={editForm.start_date ? new Date(editForm.start_date).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, start_date: new Date(e.target.value).toISOString() }))}
                  className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  End Date
                </label>
                <Input
                  type="datetime-local"
                  value={editForm.end_date ? new Date(editForm.end_date).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, end_date: new Date(e.target.value).toISOString() }))}
                  className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Location
              </label>
              <Input
                value={editForm.location ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Tags (comma-separated)
              </label>
              <Input
                value={(editForm.tags ?? []).join(", ")}
                onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }))}
                className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setEditingEvent(null)}
              className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveEdit}
              disabled={actionLoading === editingEvent?.id}
              className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium rounded-md bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              Save
            </button>
            <button
              onClick={saveAndApprove}
              disabled={actionLoading === editingEvent?.id}
              className="inline-flex items-center gap-1.5 justify-center h-9 px-4 text-sm font-medium rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Save &amp; Approve
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

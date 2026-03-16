"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useAuthStore } from "@/store/useAuthStore";
import { CreateEventForm } from "@/components/events/CreateEventForm";
import { SignInButton } from "@/components/auth/SignInButton";
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
  CalendarX,
  Calendar,
  Pencil,
  Eye,
  Plus,
  LogIn,
  ChevronRight,
  AlertTriangle,
  MessageSquareWarning,
} from "lucide-react";
import type { EventTag } from "@/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MyEvent {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date?: string | null;
  location: string;
  tags: EventTag[];
  image_url?: string | null;
  category?: string | null;
  status: "pending" | "approved" | "rejected";
  club_id?: string | null;
  club?: { id: string; name: string; logo_url?: string | null } | null;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const statusBadgeClasses: Record<MyEvent["status"], string> = {
  pending:
    "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  approved:
    "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  rejected:
    "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
};

const filterTabs: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MyEventsPage() {
  const { user, loading: authLoading } = useAuthStore();
  const {
    data,
    isLoading: eventsLoading,
    mutate,
  } = useSWR<{ events: MyEvent[] }>(
    user ? "/api/events/my-events" : null,
    fetcher
  );

  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");
  const [editingEvent, setEditingEvent] = useState<MyEvent | null>(null);

  const events = data?.events ?? [];

  const filteredEvents = useMemo(() => {
    if (activeFilter === "all") return events;
    return events.filter((e) => e.status === activeFilter);
  }, [events, activeFilter]);

  const counts = useMemo(() => {
    const c = { all: events.length, pending: 0, approved: 0, rejected: 0 };
    for (const e of events) {
      c[e.status]++;
    }
    return c;
  }, [events]);

  /* ---- Auth guard ---- */
  if (authLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-10 py-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64 mb-8" />
          <div className="flex gap-2 mb-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-10 py-8">
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-card rounded-2xl border border-border p-8 max-w-lg mx-auto">
            <div className="rounded-full bg-primary/10 p-4">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground">
              Sign in to view your events
            </h3>
            <p className="text-muted-foreground max-w-md">
              You need to be signed in with your McGill account to see events
              you&apos;ve created.
            </p>
            <SignInButton variant="default" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-10 py-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 mb-6 text-sm">
          <Link
            className="text-muted-foreground hover:text-primary transition-colors"
            href="/"
          >
            Dashboard
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-primary font-semibold">My Events</span>
        </nav>

        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">
              My Events
            </h1>
            <p className="text-muted-foreground mt-1">
              Events you&apos;ve created and their current status.
            </p>
          </div>
          <Button asChild>
            <Link href="/create-event">
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Link>
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeFilter === tab.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-70">
                {counts[tab.value]}
              </span>
            </button>
          ))}
        </div>

        {/* Loading State */}
        {eventsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : filteredEvents.length === 0 && events.length === 0 ? (
          /* Empty State — no events at all */
          <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col items-center justify-center py-16 text-center">
            <CalendarX className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-foreground font-medium">
              You haven&apos;t created any events yet
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Create your first event and share it with the McGill community.
            </p>
            <Button asChild className="mt-4">
              <Link href="/create-event">
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Link>
            </Button>
          </div>
        ) : filteredEvents.length === 0 ? (
          /* Empty State — no events for this filter */
          <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col items-center justify-center py-16 text-center">
            <CalendarX className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-foreground font-medium">
              No {activeFilter} events
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              You don&apos;t have any events with this status.
            </p>
          </div>
        ) : (
          /* Events Table */
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">
                      Event
                    </th>
                    <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">
                      Date
                    </th>
                    <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs text-center">
                      Status
                    </th>
                    <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEvents.map((event) => (
                    <tr
                      key={event.id}
                      className="hover:bg-muted/30 transition-colors duration-150"
                    >
                      {/* Event Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <Calendar className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground block truncate">
                              {event.title}
                            </span>
                            {event.club && (
                              <span className="text-xs text-muted-foreground">
                                {event.club.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {formatDate(event.start_date)}
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusBadgeClasses[event.status]}`}
                        >
                          {event.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        {event.status === "pending" && (
                          <button
                            onClick={() => setEditingEvent(event)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-primary hover:bg-primary/10 transition-colors duration-150"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        )}
                        {event.status === "approved" && (
                          <Link
                            href={`/events/${event.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-primary hover:bg-primary/10 transition-colors duration-150"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Link>
                        )}
                        {event.status === "rejected" && (
                          <Link
                            href={`/events/${event.id}/appeal`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors duration-150"
                          >
                            <MessageSquareWarning className="h-3.5 w-3.5" />
                            Appeal
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rejected events notice */}
        {counts.rejected > 0 && activeFilter === "all" && (
          <div className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-sm flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {counts.rejected} event{counts.rejected > 1 ? "s" : ""} rejected
              </p>
              <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                You can appeal rejected events to have them reviewed again by an
                admin.
              </p>
            </div>
          </div>
        )}
      </main>

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
              Update the details of your pending event.
            </DialogDescription>
          </DialogHeader>
          {editingEvent && (
            <CreateEventForm
              clubId={editingEvent.club_id ?? undefined}
              eventId={editingEvent.id}
              mode="edit"
              initialData={{
                title: editingEvent.title,
                description: editingEvent.description,
                start_date: editingEvent.start_date,
                end_date: editingEvent.end_date,
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
    </div>
  );
}

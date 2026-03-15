"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RejectionModal } from "@/components/moderation/RejectionModal";
import { AppealBadge } from "@/components/moderation/AppealBadge";
import { ReviewThread } from "@/components/moderation/ReviewThread";
import type { RejectionCategory } from "@/types";
import {
  Trash2,
  Search,
  Calendar,
  Eye,
  Bookmark,
  TrendingUp,
  ArrowUpDown,
  CheckCircle,
  XCircle,
  Inbox,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

interface EventMetrics {
  popularity_score: number;
  trending_score: number;
  view_count: number;
  click_count: number;
  save_count: number;
  calendar_add_count: number;
  unique_viewers: number;
}

interface AdminEvent {
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
  metrics: EventMetrics | null;
  appeal_count: number;
}

type SortField = "created_at" | "popularity_score" | "view_count" | "click_count" | "save_count";

export default function ModerationEventsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [rejectingEvent, setRejectingEvent] = useState<AdminEvent | null>(null);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all" && statusFilter !== "appeals") params.set("status", statusFilter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("sort", sortBy);
      params.set("direction", sortDir);

      const res = await fetch(`/api/admin/events?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
        setTotal(data.total ?? 0);
      }
      setLoading(false);
    }
    fetchEvents();
  }, [statusFilter, searchQuery, sortBy, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
    if (res.ok) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setTotal((prev) => prev - 1);
    }
    setDeleteConfirm(null);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const res = await fetch(`/api/admin/events/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e))
      );
    }
  };

  const handleReject = async (category: RejectionCategory, message: string) => {
    if (!rejectingEvent) return;
    const res = await fetch(`/api/admin/events/${rejectingEvent.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected", category, message }),
    });
    if (res.ok) {
      setEvents((prev) =>
        prev.map((e) => (e.id === rejectingEvent.id ? { ...e, status: "rejected" } : e))
      );
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Approved
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Pending
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {status}
          </span>
        );
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "desc" ? (
      <ArrowDown className="h-3 w-3" />
    ) : (
      <ArrowUp className="h-3 w-3" />
    );
  };

  const sortFields: { field: SortField; label: string }[] = [
    { field: "created_at", label: "Date" },
    { field: "popularity_score", label: "Popularity" },
    { field: "view_count", label: "Views" },
    { field: "click_count", label: "Clicks" },
    { field: "save_count", label: "Saves" },
  ];

  const displayedEvents = statusFilter === "appeals"
    ? events.filter((e) => e.appeal_count > 0 && e.status === "pending")
    : events;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Event Queue
        </h2>
        <Badge className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-900 dark:hover:bg-zinc-100">
          {total}
        </Badge>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-100/10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-100/10"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="appeals">Appeals Only</option>
        </select>
        <div className="flex items-center gap-1">
          {sortFields.map(({ field, label }) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                sortBy === field
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {label}
              <SortIcon field={field} />
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3 w-32 rounded bg-zinc-100 dark:bg-zinc-800/60" />
                </div>
                <div className="h-3 w-20 rounded bg-zinc-100 dark:bg-zinc-800/60" />
                <div className="h-5 w-16 rounded-full bg-zinc-100 dark:bg-zinc-800/60" />
                <div className="flex gap-2">
                  <div className="h-8 w-8 rounded bg-zinc-100 dark:bg-zinc-800/60" />
                  <div className="h-8 w-8 rounded bg-zinc-100 dark:bg-zinc-800/60" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : displayedEvents.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-500">
            <Inbox className="h-10 w-10 mb-3 stroke-[1.5]" />
            <p className="text-sm font-medium">No events found</p>
            <p className="text-xs mt-1">Try adjusting your filters or search query.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_140px_100px_120px_130px] gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
            <span>Event</span>
            <span>Date</span>
            <span>Status</span>
            <span>Metrics</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Table rows */}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {displayedEvents.map((event) => (
              <div key={event.id}>
              <div
                className="sm:grid sm:grid-cols-[1fr_140px_100px_120px_130px] gap-4 px-5 py-4 items-center hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
              >
                {/* Event title & organizer */}
                <div className="min-w-0 mb-2 sm:mb-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {event.title}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {event.organizer ?? "Unknown organizer"}
                  </p>
                </div>

                {/* Date */}
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mb-2 sm:mb-0">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>{new Date(event.start_date).toLocaleDateString()}</span>
                </div>

                {/* Status */}
                <div className="mb-2 sm:mb-0 flex items-center">
                  {statusBadge(event.status)}
                  {event.appeal_count > 0 && (
                    <button onClick={() => setExpandedThread(expandedThread === event.id ? null : event.id)} className="ml-1">
                      <AppealBadge appealCount={event.appeal_count} />
                    </button>
                  )}
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mb-2 sm:mb-0">
                  <span className="flex items-center gap-1" title="Views">
                    <Eye className="h-3.5 w-3.5" />
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {event.metrics?.view_count ?? 0}
                    </span>
                  </span>
                  <span className="flex items-center gap-1" title="Saves">
                    <Bookmark className="h-3.5 w-3.5" />
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {event.metrics?.save_count ?? 0}
                    </span>
                  </span>
                  <span className="flex items-center gap-1" title="Popularity">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {event.metrics?.popularity_score != null
                        ? event.metrics.popularity_score.toFixed(1)
                        : "—"}
                    </span>
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1.5">
                  {deleteConfirm === event.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-red-600 dark:text-red-400 mr-1">Delete?</span>
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="inline-flex items-center justify-center h-7 px-2.5 text-xs font-medium rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="inline-flex items-center justify-center h-7 px-2.5 text-xs font-medium rounded-md text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <>
                      {event.status !== "approved" && (
                        <button
                          onClick={() => handleStatusChange(event.id, "approved")}
                          title="Approve"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      {event.status !== "rejected" && (
                        <button
                          onClick={() => setRejectingEvent(event)}
                          title="Reject"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteConfirm(event.id)}
                        title="Delete"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {expandedThread === event.id && (
                <div className="col-span-full px-5 py-4 border-t border-zinc-100 dark:border-zinc-800">
                  <ReviewThread targetType="event" targetId={event.id} />
                </div>
              )}
              </div>
            ))}
          </div>
        </div>
      )}

      {rejectingEvent && (
        <RejectionModal
          open={!!rejectingEvent}
          onOpenChange={(open) => !open && setRejectingEvent(null)}
          itemName={rejectingEvent.title}
          itemType="event"
          onSubmit={handleReject}
        />
      )}
    </div>
  );
}

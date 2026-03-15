"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Star, Trash2, Pencil, Plus, Search, Calendar } from "lucide-react";
import { FeatureEventModal } from "@/components/moderation/FeatureEventModal";

interface FeaturedRow {
  id: string;
  event_id: string;
  sponsor_name: string | null;
  priority: number;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
  event: {
    id: string;
    title: string;
    image_url: string | null;
    event_date: string;
    event_time: string;
    status: string;
  } | null;
}

type Tab = "active" | "upcoming" | "expired";

export default function FeaturedManagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>("active");
  const [data, setData] = useState<{
    active: FeaturedRow[];
    upcoming: FeaturedRow[];
    expired: FeaturedRow[];
  }>({ active: [], upcoming: [], expired: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<FeaturedRow | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEventId, setAddEventId] = useState("");
  const [addEventTitle, setAddEventTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: string; title: string }[]
  >([]);
  const [searching, setSearching] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/featured");
      if (!res.ok) return;
      const json = await res.json();
      setData({
        active: json.active ?? [],
        upcoming: json.upcoming ?? [],
        expired: json.expired ?? [],
      });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this featured event?")) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/featured/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchData();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const searchEvents = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/admin/events?status=approved&search=${encodeURIComponent(query)}&limit=10`
      );
      if (res.ok) {
        const json = await res.json();
        setSearchResults(
          (json.events ?? []).map((e: any) => ({
            id: e.id,
            title: e.title,
          }))
        );
      }
    } finally {
      setSearching(false);
    }
  };

  const selectEventForAdd = (id: string, title: string) => {
    setAddEventId(id);
    setAddEventTitle(title);
    setSearchResults([]);
    setSearchQuery("");
  };

  const rows = data[activeTab];
  const totalCount = data.active.length + data.upcoming.length + data.expired.length;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "active", label: "Active", count: data.active.length },
    { key: "upcoming", label: "Upcoming", count: data.upcoming.length },
    { key: "expired", label: "Expired", count: data.expired.length },
  ];

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const statusBadge = (tab: Tab) => {
    switch (tab) {
      case "active":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "upcoming":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "expired":
        return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500";
    }
  };

  const statusLabel = (tab: Tab) => {
    switch (tab) {
      case "active":
        return "Active";
      case "upcoming":
        return "Upcoming";
      case "expired":
        return "Expired";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Featured Events
          </h2>
          {totalCount > 0 && (
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {totalCount} total
            </span>
          )}
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="gap-2"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          Add Featured
        </Button>
      </div>

      {/* Pill Tabs */}
      <div className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-zinc-400 dark:text-zinc-500">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-700 rounded" />
                  <div className="h-3 w-32 bg-zinc-100 dark:bg-zinc-800 rounded" />
                </div>
                <div className="h-5 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
                <div className="h-8 w-16 bg-zinc-100 dark:bg-zinc-800 rounded" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-500">
            <Star className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">
              No {activeTab} featured events
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Event
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Sponsor
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Priority
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Duration
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
                        <Star className="h-4 w-4 text-amber-500" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[200px]">
                          {row.event?.title ?? "Unknown event"}
                        </p>
                        {row.event?.event_date && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                            <Calendar className="h-3 w-3" />
                            {new Date(row.event.event_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                    {row.sponsor_name || (
                      <span className="text-zinc-400 dark:text-zinc-600">
                        --
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {row.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 text-xs">
                    <span>{formatDate(row.starts_at)}</span>
                    <span className="mx-1 text-zinc-300 dark:text-zinc-600">
                      -
                    </span>
                    <span>{formatDate(row.ends_at)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(activeTab)}`}
                    >
                      {statusLabel(activeTab)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingRow(row)}
                        disabled={actionLoading === row.id}
                        className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        disabled={actionLoading === row.id}
                        className="p-1.5 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950 disabled:opacity-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit modal */}
      {editingRow && editingRow.event && (
        <FeatureEventModal
          open={!!editingRow}
          onOpenChange={(open) => !open && setEditingRow(null)}
          eventId={editingRow.event_id}
          eventTitle={editingRow.event.title}
          existing={{
            id: editingRow.id,
            sponsor_name: editingRow.sponsor_name,
            priority: editingRow.priority,
            starts_at: editingRow.starts_at,
            ends_at: editingRow.ends_at,
          }}
          onSubmit={() => {
            setEditingRow(null);
            fetchData();
          }}
        />
      )}

      {/* Add modal -- event search */}
      {showAddModal && !addEventId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md shadow-xl border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Select an Approved Event
            </h3>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search events..."
                className="w-full pl-9 pr-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600"
                value={searchQuery}
                onChange={(e) => searchEvents(e.target.value)}
                autoFocus
              />
            </div>
            {searching && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                Searching...
              </p>
            )}
            <div className="max-h-60 overflow-y-auto space-y-0.5">
              {searchResults.map((event) => (
                <button
                  key={event.id}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer transition-colors"
                  onClick={() => selectEventForAdd(event.id, event.title)}
                >
                  {event.title}
                </button>
              ))}
              {searchQuery.length >= 2 &&
                !searching &&
                searchResults.length === 0 && (
                  <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-4">
                    No events found
                  </p>
                )}
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddModal(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && addEventId && (
        <FeatureEventModal
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setShowAddModal(false);
              setAddEventId("");
              setAddEventTitle("");
            }
          }}
          eventId={addEventId}
          eventTitle={addEventTitle}
          onSubmit={() => {
            setShowAddModal(false);
            setAddEventId("");
            setAddEventTitle("");
            fetchData();
          }}
        />
      )}
    </div>
  );
}

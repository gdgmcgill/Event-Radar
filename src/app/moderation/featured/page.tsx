"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Trash2, Pencil, Plus } from "lucide-react";
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

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "active", label: "Active", count: data.active.length },
    { key: "upcoming", label: "Upcoming", count: data.upcoming.length },
    { key: "expired", label: "Expired", count: data.expired.length },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Featured Events</h2>
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Star className="h-6 w-6 text-yellow-500" />
          Featured Events
        </h2>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Featured Event
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <Badge variant="secondary" className="ml-2">
              {tab.count}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No {activeTab} featured events.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {row.event?.title ?? "Unknown event"}
                    </CardTitle>
                    {row.sponsor_name && (
                      <p className="text-sm text-muted-foreground">
                        Sponsored by {row.sponsor_name}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">Priority: {row.priority}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
                  <span>
                    Start:{" "}
                    {new Date(row.starts_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>
                    End:{" "}
                    {new Date(row.ends_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {row.event?.event_date && (
                    <span>
                      Event date:{" "}
                      {new Date(row.event.event_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingRow(row)}
                    disabled={actionLoading === row.id}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(row.id)}
                    disabled={actionLoading === row.id}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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

      {/* Add modal — event search + feature modal */}
      {showAddModal && !addEventId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl p-6 w-full max-w-md shadow-xl border">
            <h3 className="text-lg font-semibold mb-4">
              Select an Approved Event
            </h3>
            <input
              type="text"
              placeholder="Search events..."
              className="w-full px-3 py-2 border rounded-lg mb-3 text-sm bg-background"
              value={searchQuery}
              onChange={(e) => searchEvents(e.target.value)}
              autoFocus
            />
            {searching && (
              <p className="text-sm text-muted-foreground">Searching...</p>
            )}
            <div className="max-h-60 overflow-y-auto space-y-1">
              {searchResults.map((event) => (
                <button
                  key={event.id}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm cursor-pointer"
                  onClick={() => selectEventForAdd(event.id, event.title)}
                >
                  {event.title}
                </button>
              ))}
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

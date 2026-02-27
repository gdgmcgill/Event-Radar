"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle, XCircle, Calendar, MapPin } from "lucide-react";

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
}

export default function PendingEventsPage() {
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Action error feedback
  const [actionError, setActionError] = useState<string | null>(null);

  // Bulk reject dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<"bulk" | string>("bulk");

  const fetchPending = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("events")
      .select("id, title, description, start_date, end_date, location, organizer, tags, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    setEvents(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  // ── Single-event actions ────────────────────────────────────────────────────

  const handleAction = async (eventId: string, status: "approved" | "rejected") => {
    if (status === "rejected") {
      setRejectTarget(eventId);
      setRejectReason("");
      setRejectDialogOpen(true);
      return;
    }

    setActionLoading(eventId);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error ?? "Action failed. Please try again.");
      }
    } catch {
      setActionError("Network error. Please check your connection.");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Selection helpers ───────────────────────────────────────────────────────

  const allSelected = events.length > 0 && selectedIds.size === events.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(events.map((e) => e.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Bulk approve ────────────────────────────────────────────────────────────

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    setActionError(null);
    const snapshot = new Set(selectedIds);
    try {
      const ids = Array.from(snapshot);
      const res = await fetch("/api/admin/events/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status: "approved" }),
      });

      if (res.ok) {
        setEvents((prev) => prev.filter((e) => !snapshot.has(e.id)));
        setSelectedIds(new Set());
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error ?? "Bulk approve failed. Please try again.");
      }
    } catch {
      setActionError("Network error. Please check your connection.");
    } finally {
      setBulkActionLoading(false);
    }
  };

  // ── Reject dialog confirm ───────────────────────────────────────────────────

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) return;

    if (rejectTarget === "bulk") {
      const snapshot = new Set(selectedIds);
      const capturedReason = rejectReason;
      setBulkActionLoading(true);
      setRejectDialogOpen(false);
      setRejectReason("");
      setActionError(null);
      try {
        const ids = Array.from(snapshot);
        const res = await fetch("/api/admin/events/bulk-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, status: "rejected", reason: capturedReason }),
        });

        if (res.ok) {
          setEvents((prev) => prev.filter((e) => !snapshot.has(e.id)));
          setSelectedIds(new Set());
        } else {
          const data = await res.json().catch(() => ({}));
          setActionError(data.error ?? "Bulk rejection failed. Please try again.");
        }
      } catch {
        setActionError("Network error. Please check your connection.");
      } finally {
        setBulkActionLoading(false);
      }
    } else {
      const eventId = rejectTarget;
      const capturedReason = rejectReason;
      setActionLoading(eventId);
      setRejectDialogOpen(false);
      setRejectReason("");
      setActionError(null);
      try {
        const res = await fetch(`/api/admin/events/${eventId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "rejected", reason: capturedReason }),
        });

        if (res.ok) {
          setEvents((prev) => prev.filter((e) => e.id !== eventId));
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(eventId);
            return next;
          });
        } else {
          const data = await res.json().catch(() => ({}));
          setActionError(data.error ?? "Rejection failed. Please try again.");
        }
      } catch {
        setActionError("Network error. Please check your connection.");
      } finally {
        setActionLoading(null);
      }
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Pending Events</h2>
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Pending Events</h2>
        <Badge variant="secondary">{events.length} pending</Badge>
      </div>

      {/* ── Error banner ── */}
      {actionError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
          <button
            className="ml-3 underline"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {events.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No pending events at this time.</p>
        </div>
      ) : (
        <>
          {/* ── Bulk action toolbar ── */}
          <div className="flex items-center gap-4 rounded-lg border bg-muted/40 px-4 py-3">
            {/* Select all */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer"
              />
              <span className="text-sm font-medium">Select all</span>
            </label>

            {/* Selection count */}
            {selectedIds.size > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
            )}

            {/* Bulk actions */}
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                disabled={selectedIds.size === 0 || bulkActionLoading}
                onClick={handleBulkApprove}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve Selected
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedIds.size === 0 || bulkActionLoading}
                onClick={() => {
                  setRejectTarget("bulk");
                  setRejectReason("");
                  setRejectDialogOpen(true);
                }}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject Selected
              </Button>
            </div>
          </div>

          {/* ── Event cards ── */}
          <div className="space-y-4">
            {events.map((event) => {
              const isSelected = selectedIds.has(event.id);
              return (
                <Card
                  key={event.id}
                  className={isSelected ? "ring-2 ring-primary" : undefined}
                >
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      {/* Per-card checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(event.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer flex-shrink-0"
                        aria-label={`Select ${event.title}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-lg">{event.title}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {event.organizer ?? "Unknown organizer"}
                            </p>
                          </div>
                          <Badge variant="outline" className="flex-shrink-0">Pending</Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pl-10">
                    {event.description && (
                      <p className="text-sm mb-3 line-clamp-3">{event.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(event.start_date).toLocaleDateString()}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {event.location}
                        </span>
                      )}
                    </div>
                    {event.tags && event.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {event.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAction(event.id, "approved")}
                        disabled={actionLoading === event.id || bulkActionLoading}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleAction(event.id, "rejected")}
                        disabled={actionLoading === event.id || bulkActionLoading}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* ── Reject reason dialog ── */}
      <Dialog
        open={rejectDialogOpen}
        onOpenChange={(open) => {
          setRejectDialogOpen(open);
          if (!open) setRejectReason("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rejectTarget === "bulk"
                ? `Reject ${selectedIds.size} event${selectedIds.size !== 1 ? "s" : ""}`
                : "Reject event"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="reject-reason">
              Reason <span className="text-destructive">*</span>
            </label>
            <textarea
              id="reject-reason"
              rows={4}
              placeholder="Provide a reason that will be shared with the organiser(s)…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim()}
              onClick={handleRejectConfirm}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

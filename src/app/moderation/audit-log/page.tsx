"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ScrollText,
  ChevronLeft,
  ChevronRight,
  Filter,
  Clock,
  User,
  Target,
} from "lucide-react";

interface AuditEntry {
  id: string;
  admin_user_id: string;
  admin_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  totalPages: number;
}

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "deleted", label: "Deleted" },
  { value: "bulk_approved", label: "Bulk Approved" },
  { value: "bulk_rejected", label: "Bulk Rejected" },
];

const ACTION_COLORS: Record<string, string> = {
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  created: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  updated: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  deleted: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  bulk_approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  bulk_rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatMetadata(metadata: Record<string, unknown>): string {
  if (!metadata || Object.keys(metadata).length === 0) return "";
  const parts: string[] = [];
  if (metadata.event_title) parts.push(`"${metadata.event_title}"`);
  if (metadata.title) parts.push(`"${metadata.title}"`);
  if (Array.isArray(metadata.fields_updated)) {
    parts.push(`Fields: ${(metadata.fields_updated as string[]).join(", ")}`);
  }
  return parts.join(" | ");
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState("");

  const fetchAuditLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: page.toString() });
      if (actionFilter) params.set("action", actionFilter);
      const res = await fetch(`/api/admin/audit-log?${params}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch audit log");
      }
      const data: AuditResponse = await res.json();
      setEntries(data.entries);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  const handleFilterChange = (value: string) => {
    setActionFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScrollText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Audit Log</h1>
          {!loading && (
            <span className="text-sm text-muted-foreground">
              {total} {total === 1 ? "entry" : "entries"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={actionFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Admin Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No audit log entries found.
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header row */}
              <div className="hidden grid-cols-[180px_1fr_100px_80px_1fr] gap-4 border-b border-border px-4 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:grid">
                <div>Time</div>
                <div>Admin</div>
                <div>Action</div>
                <div>Target</div>
                <div>Details</div>
              </div>

              {entries.map((entry) => {
                const details = formatMetadata(entry.metadata);
                return (
                  <div
                    key={entry.id}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-border p-4 text-sm sm:grid-cols-[180px_1fr_100px_80px_1fr] sm:items-center sm:gap-4"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {formatTimestamp(entry.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {entry.admin_email || entry.admin_user_id.slice(0, 8)}
                      </span>
                    </div>

                    <div>
                      <Badge
                        className={`${ACTION_COLORS[entry.action] || "bg-gray-100 text-gray-800"} border-0 text-xs`}
                      >
                        {entry.action}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1">
                      <Target className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="capitalize">{entry.target_type}</span>
                    </div>

                    <div className="truncate text-muted-foreground">
                      {details || (
                        <span className="text-xs">
                          ID: {entry.target_id.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

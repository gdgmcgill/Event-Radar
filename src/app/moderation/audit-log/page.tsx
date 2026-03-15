"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ScrollText,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileText,
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
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  created: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  updated: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  deleted: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  bulk_approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  bulk_rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function fullTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100">
            <ScrollText className="h-5 w-5 text-white dark:text-zinc-900" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Audit Log
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Track all admin actions
            </p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-400" />
          <select
            value={actionFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 transition-shadow"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="hidden sm:grid grid-cols-[120px_1fr_110px_100px_1fr] gap-4 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
          <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Timestamp</span>
          <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Admin</span>
          <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Action</span>
          <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Target</span>
          <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Details</span>
        </div>

        {loading ? (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="hidden sm:grid grid-cols-[120px_1fr_110px_100px_1fr] gap-4 px-6 py-4 items-center">
                <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                <div className="h-5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              No audit log entries found
            </p>
            {actionFilter && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                Try changing the action filter
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {entries.map((entry) => {
              const details = formatMetadata(entry.metadata);
              return (
                <div
                  key={entry.id}
                  className="grid grid-cols-1 sm:grid-cols-[120px_1fr_110px_100px_1fr] gap-2 sm:gap-4 px-6 py-4 items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  {/* Timestamp */}
                  <span
                    className="text-sm text-zinc-500 dark:text-zinc-400"
                    title={fullTimestamp(entry.created_at)}
                  >
                    {relativeTime(entry.created_at)}
                  </span>

                  {/* Admin */}
                  <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                    {entry.admin_email || entry.admin_user_id.slice(0, 8)}
                  </span>

                  {/* Action */}
                  <div>
                    <Badge
                      className={`${ACTION_COLORS[entry.action] || "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"} border-0 text-xs font-medium`}
                    >
                      {entry.action.replace("_", " ")}
                    </Badge>
                  </div>

                  {/* Target */}
                  <span className="text-sm text-zinc-600 dark:text-zinc-300 capitalize">
                    {entry.target_type}
                  </span>

                  {/* Details */}
                  <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                    {details || (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        ID: {entry.target_id.slice(0, 8)}...
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="text-xs"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="text-xs"
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

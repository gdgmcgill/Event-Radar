"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Flag,
  Loader2,
  CheckCircle,
  XCircle,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { REJECTION_CATEGORIES, type RejectionCategory } from "@/types";

interface ReportItem {
  id: string;
  event_id: string;
  reporter_id: string;
  category: RejectionCategory;
  message: string | null;
  status: string;
  created_at: string;
  report_count: number;
  event: { id: string; title: string; status: string };
  reporter: { id: string; display_name: string; avatar_url: string | null };
}

type StatusFilter = "all" | "pending" | "reviewed" | "dismissed";

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      const res = await fetch(`/api/admin/reports?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleAction = async (reportId: string, status: "reviewed" | "dismissed") => {
    setActionLoading(reportId);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await fetchReports();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to update report. Please try again.");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const filterTabs: { label: string; value: StatusFilter }[] = [
    { label: "Pending", value: "pending" },
    { label: "Reviewed", value: "reviewed" },
    { label: "Dismissed", value: "dismissed" },
    { label: "All", value: "all" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Reported Events
        </h2>
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {reports.length}
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg w-fit">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === tab.value
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reports list */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-500">
            <Flag className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">No reports</p>
            <p className="text-xs mt-1">
              {filter === "pending"
                ? "No pending reports to review."
                : "No reports match this filter."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {reports.map((report) => (
              <div
                key={report.id}
                className="px-5 py-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="h-9 w-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Flag className="h-4 w-4 text-red-500 dark:text-red-400" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/events/${report.event_id}`}
                        className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-primary truncate"
                      >
                        {report.event?.title ?? "Unknown Event"}
                      </Link>
                      {report.report_count > 1 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                          {report.report_count} reports
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {REJECTION_CATEGORIES[report.category] ?? report.category}
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        by {report.reporter?.display_name ?? "Unknown"}
                      </span>
                    </div>

                    {report.message && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 whitespace-pre-wrap">
                        {report.message}
                      </p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0 hidden sm:block">
                    {new Date(report.created_at).toLocaleDateString()}
                  </span>

                  {/* Actions */}
                  {report.status === "pending" && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleAction(report.id, "reviewed")}
                        disabled={actionLoading === report.id}
                        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === report.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5" />
                        )}
                        Review
                      </button>
                      <button
                        onClick={() => handleAction(report.id, "dismissed")}
                        disabled={actionLoading === report.id}
                        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-zinc-500 text-white hover:bg-zinc-600 disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Dismiss
                      </button>
                      <Link
                        href={`/events/${report.event_id}`}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="View event"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

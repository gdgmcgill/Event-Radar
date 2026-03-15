"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  UserCheck,
  Loader2,
} from "lucide-react";

interface OrganizerRequest {
  id: string;
  user_id: string;
  club_id: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  club: {
    id: string;
    name: string;
  } | null;
  user: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
] as const;

export default function OrganizerRequestsPage() {
  const [requests, setRequests] = useState<OrganizerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("pending");

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: statusFilter });
    const res = await fetch(`/api/admin/organizer-requests?${params}`);
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests ?? []);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async (requestId: string, status: "approved" | "rejected") => {
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/admin/organizer-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            Approved
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Pending
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Organizer Requests
        </h2>
        {pendingCount > 0 && (
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-36 bg-zinc-200 dark:bg-zinc-700 rounded" />
                  <div className="h-3 w-48 bg-zinc-100 dark:bg-zinc-800 rounded" />
                </div>
                <div className="h-5 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-500">
            <UserCheck className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">
              No {statusFilter === "all" ? "" : statusFilter} organizer requests found
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Requester
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Club
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Message
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Submitted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {requests.map((request) => (
                <tr
                  key={request.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-semibold text-zinc-600 dark:text-zinc-300 shrink-0">
                        {(request.user?.name || request.user?.email || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {request.user?.name || "Unknown user"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                    {request.user?.email || "--"}
                  </td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                    {request.club?.name || "Unknown club"}
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    {request.message ? (
                      <span
                        className="text-zinc-500 dark:text-zinc-400 line-clamp-1 cursor-help"
                        title={request.message}
                      >
                        {request.message}
                      </span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500">--</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                    {new Date(request.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">{statusBadge(request.status)}</td>
                  <td className="px-6 py-4 text-right">
                    {request.status === "pending" && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleAction(request.id, "approved")}
                          disabled={actionLoading === request.id}
                          className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 disabled:opacity-50 transition-colors"
                          title="Approve"
                        >
                          {actionLoading === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleAction(request.id, "rejected")}
                          disabled={actionLoading === request.id}
                          className="p-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50 transition-colors"
                          title="Reject"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

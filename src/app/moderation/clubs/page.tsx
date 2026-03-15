"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  Building2,
  Loader2,
} from "lucide-react";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { EventTag } from "@/types";

interface ClubWithCreator {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  instagram_handle: string | null;
  logo_url: string | null;
  status: string;
  created_at: string;
  creator: {
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

export default function ClubModerationPage() {
  const [clubs, setClubs] = useState<ClubWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("pending");

  const fetchClubs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: statusFilter });
    const res = await fetch(`/api/admin/clubs?${params}`);
    if (res.ok) {
      const data = await res.json();
      setClubs(data.clubs ?? []);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  const handleAction = async (clubId: string, status: "approved" | "rejected") => {
    setActionLoading(clubId);
    try {
      const res = await fetch(`/api/admin/clubs/${clubId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setClubs((prev) => prev.filter((c) => c.id !== clubId));
      }
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = clubs.filter((c) => c.status === "pending").length;

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
          Club Approvals
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
                  <div className="h-4 w-40 bg-zinc-200 dark:bg-zinc-700 rounded" />
                  <div className="h-3 w-24 bg-zinc-100 dark:bg-zinc-800 rounded" />
                </div>
                <div className="h-5 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
              </div>
            ))}
          </div>
        ) : clubs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-500">
            <Building2 className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">
              No {statusFilter === "all" ? "" : statusFilter} clubs found
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Club Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Creator
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Category
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
              {clubs.map((club) => (
                <tr
                  key={club.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-semibold text-zinc-600 dark:text-zinc-300 shrink-0">
                        {club.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {club.name}
                        </p>
                        {club.description && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1 max-w-xs">
                            {club.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                    {club.creator?.name || club.creator?.email || "Unknown"}
                  </td>
                  <td className="px-6 py-4">
                    {club.category && EVENT_CATEGORIES[club.category as EventTag] ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {EVENT_CATEGORIES[club.category as EventTag].label}
                      </span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500">--</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                    {new Date(club.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">{statusBadge(club.status)}</td>
                  <td className="px-6 py-4 text-right">
                    {club.status === "pending" && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleAction(club.id, "approved")}
                          disabled={actionLoading === club.id}
                          className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 disabled:opacity-50 transition-colors"
                          title="Approve"
                        >
                          {actionLoading === club.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleAction(club.id, "rejected")}
                          disabled={actionLoading === club.id}
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

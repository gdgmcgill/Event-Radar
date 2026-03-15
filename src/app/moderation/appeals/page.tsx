"use client";

import { useEffect, useState, useCallback } from "react";
import { RejectionModal } from "@/components/moderation/RejectionModal";
import { AppealBadge } from "@/components/moderation/AppealBadge";
import { ReviewThread } from "@/components/moderation/ReviewThread";
import type { RejectionCategory } from "@/types";
import {
  CheckCircle,
  XCircle,
  Loader2,
  MessageSquare,
  Calendar,
  Building2,
} from "lucide-react";

interface AppealItem {
  id: string;
  name: string;
  type: "event" | "club";
  appeal_count: number;
  created_at: string;
  status: string;
}

export default function AppealsPage() {
  const [items, setItems] = useState<AppealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingItem, setRejectingItem] = useState<AppealItem | null>(null);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);

  const fetchAppeals = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, clubsRes] = await Promise.all([
        fetch("/api/admin/events?status=pending"),
        fetch("/api/admin/clubs?status=pending"),
      ]);

      const combined: AppealItem[] = [];

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        const events = (eventsData.events ?? []).filter(
          (e: { appeal_count?: number }) => (e.appeal_count ?? 0) > 0
        );
        combined.push(
          ...events.map((e: { id: string; title: string; appeal_count: number; created_at: string; status: string }) => ({
            id: e.id,
            name: e.title,
            type: "event" as const,
            appeal_count: e.appeal_count,
            created_at: e.created_at,
            status: e.status,
          }))
        );
      }

      if (clubsRes.ok) {
        const clubsData = await clubsRes.json();
        const clubs = (clubsData.clubs ?? []).filter(
          (c: { appeal_count?: number }) => (c.appeal_count ?? 0) > 0
        );
        combined.push(
          ...clubs.map((c: { id: string; name: string; appeal_count: number; created_at: string; status: string }) => ({
            id: c.id,
            name: c.name,
            type: "club" as const,
            appeal_count: c.appeal_count,
            created_at: c.created_at,
            status: c.status,
          }))
        );
      }

      combined.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setItems(combined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppeals();
  }, [fetchAppeals]);

  const handleApprove = async (item: AppealItem) => {
    setActionLoading(item.id);
    try {
      const endpoint =
        item.type === "event"
          ? `/api/admin/events/${item.id}/status`
          : `/api/admin/clubs/${item.id}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (
    category: RejectionCategory,
    message: string
  ) => {
    if (!rejectingItem) return;
    setActionLoading(rejectingItem.id);
    try {
      const endpoint =
        rejectingItem.type === "event"
          ? `/api/admin/events/${rejectingItem.id}/status`
          : `/api/admin/clubs/${rejectingItem.id}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected", category, message }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== rejectingItem.id));
      }
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Appeals
        </h2>
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
          {items.length}
        </span>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-500">
            <MessageSquare className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">No pending appeals</p>
            <p className="text-xs mt-1">
              Appeals will appear here when organizers contest rejections.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {items.map((item) => (
              <div key={`${item.type}-${item.id}`}>
                <div className="px-5 py-4 flex items-center gap-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                  {/* Type icon */}
                  <div className="h-9 w-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                    {item.type === "event" ? (
                      <Calendar className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                    ) : (
                      <Building2 className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                    )}
                  </div>

                  {/* Name + type */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                      {item.type}
                    </p>
                  </div>

                  {/* Appeal badge */}
                  <button
                    onClick={() =>
                      setExpandedThread(
                        expandedThread === item.id ? null : item.id
                      )
                    }
                  >
                    <AppealBadge appealCount={item.appeal_count} />
                  </button>

                  {/* Date */}
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0 hidden sm:block">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleApprove(item)}
                      disabled={actionLoading === item.id}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectingItem(item)}
                      disabled={actionLoading === item.id}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                </div>

                {/* Expanded review thread */}
                {expandedThread === item.id && (
                  <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                    <ReviewThread targetType={item.type} targetId={item.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {rejectingItem && (
        <RejectionModal
          open={!!rejectingItem}
          onOpenChange={(open) => !open && setRejectingItem(null)}
          itemName={rejectingItem.name}
          itemType={rejectingItem.type}
          onSubmit={handleReject}
        />
      )}
    </div>
  );
}

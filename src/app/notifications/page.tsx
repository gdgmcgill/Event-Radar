"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { NotificationList } from "@/components/notifications/NotificationList";
import type { Notification } from "@/types";
import { SignInButton } from "@/components/auth/SignInButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCheck,
  LogIn,
  RefreshCcw,
  AlertCircle,
  Bell as BellIcon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { notifyCountChanged } from "@/hooks/useNotificationCount";

type FilterTab = "all" | "events" | "social" | "clubs";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "events", label: "Events" },
  { key: "social", label: "Social" },
  { key: "clubs", label: "Clubs" },
];

/** Map notification type to a filter category */
function typeToCategory(type: string): FilterTab {
  if (type.startsWith("event_")) return "events";
  if (
    type === "new_follower" ||
    type === "new_friend" ||
    type.includes("rsvp") ||
    type.includes("social")
  )
    return "social";
  if (type.startsWith("club_") || type.includes("club") || type.includes("group"))
    return "clubs";
  return "events";
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (cursor?: string) => {
    try {
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const url = cursor
        ? `/api/notifications?cursor=${encodeURIComponent(cursor)}`
        : "/api/notifications";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();

      if (cursor) {
        setNotifications((prev) => [...prev, ...(data.notifications || [])]);
      } else {
        setNotifications(data.notifications || []);
      }
      setUnreadCount(data.unread_count || 0);
      setNextCursor(data.next_cursor || null);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError("Failed to load notifications.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user, fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      notifyCountChanged();
    } catch {
      fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      await fetch("/api/notifications?action=mark-all-read", { method: "POST" });
      notifyCountChanged();
    } catch {
      fetchNotifications();
    }
  };

  const filteredNotifications = useMemo(() => {
    if (activeTab === "all") return notifications;
    return notifications.filter((n) => typeToCategory(n.type) === activeTab);
  }, [notifications, activeTab]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="max-w-4xl w-full mx-auto flex-1 px-4 md:px-8">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md pt-6 pb-6 mb-2 border-b border-border">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-foreground text-3xl font-bold leading-tight">
                Notifications
              </h1>
              <p className="text-muted-foreground text-sm font-normal leading-normal">
                Stay updated on campus events and connections
              </p>
            </div>
            {user && unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center justify-center rounded-lg h-9 px-4 bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground text-sm font-medium leading-normal transition-colors border border-border/50 backdrop-blur-sm cursor-pointer gap-2"
              >
                <CheckCheck className="h-4 w-4" />
                <span className="truncate">Mark all as read</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 mt-5 bg-secondary/40 rounded-lg p-1 w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer",
                  activeTab === tab.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {authLoading ? (
          <div className="space-y-3 mt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-card/50 rounded-xl border border-border backdrop-blur-sm p-8 mt-4">
            <div className="rounded-full bg-primary/10 p-4">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground">
              Sign in to view notifications
            </h3>
            <p className="text-muted-foreground max-w-md">
              You need to be signed in to receive and view notifications.
            </p>
            <SignInButton variant="default" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-card/50 rounded-xl border border-destructive/30 backdrop-blur-sm p-8 mt-4">
            <div className="rounded-full bg-primary/10 p-4">
              <AlertCircle className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-foreground">
                Something went wrong
              </h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
            <Button onClick={() => fetchNotifications()} variant="outline" className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-3 mt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <NotificationList
              notifications={filteredNotifications}
              onMarkRead={handleMarkRead}
            />

            {/* Load More */}
            {nextCursor && activeTab === "all" && (
              <div className="flex justify-center py-8">
                <Button
                  variant="outline"
                  onClick={() => fetchNotifications(nextCursor)}
                  disabled={loadingMore}
                  className="gap-2"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {loadingMore ? "Loading..." : "Load older notifications"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

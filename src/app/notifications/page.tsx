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
  ChevronDown,
  Bell as BellIcon,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "events" | "social" | "clubs";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "events", label: "Events" },
  { key: "social", label: "Social" },
  { key: "clubs", label: "Clubs" },
];

/** Map notification type to a filter category */
function typeToCategory(type: string): FilterTab {
  if (
    type.startsWith("event_") ||
    type === "event_reminder_24h" ||
    type === "event_reminder_1h"
  )
    return "events";
  if (
    type === "new_follower" ||
    type === "new_friend" ||
    type === "friend_request" ||
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
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError("Failed to load notifications.");
    } finally {
      setLoading(false);
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
    } catch {
      fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      await fetch("/api/notifications?action=mark-all-read", { method: "POST" });
    } catch {
      fetchNotifications();
    }
  };

  const filteredNotifications = useMemo(() => {
    if (activeTab === "all") return notifications;
    return notifications.filter((n) => typeToCategory(n.type) === activeTab);
  }, [notifications, activeTab]);

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-6 py-8">
        {/* Header & Tabs */}
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                Notifications
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Stay updated with your campus life
              </p>
            </div>
            {user && unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-red-600 text-sm font-semibold hover:underline flex items-center gap-1"
              >
                <CheckCheck className="size-4" />
                Mark all as read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex flex-col items-center justify-center border-b-2 pb-3 px-2 transition-all",
                  activeTab === tab.key
                    ? "border-red-600 text-red-600"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                )}
              >
                <p className="text-sm font-bold whitespace-nowrap">{tab.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {authLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
            <div className="rounded-full bg-red-600/10 p-4">
              <LogIn className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Sign in to view notifications
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">
              You need to be signed in to receive and view notifications.
            </p>
            <SignInButton variant="default" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/30 p-8">
            <div className="rounded-full bg-red-600/10 p-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Something went wrong
              </h3>
              <p className="text-slate-500 dark:text-slate-400">{error}</p>
            </div>
            <Button onClick={fetchNotifications} variant="outline" className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <NotificationList
            notifications={filteredNotifications}
            onMarkRead={handleMarkRead}
          />
        )}

        {/* Load previous notifications */}
        {user && !loading && !error && notifications.length > 0 && (
          <div className="mt-12 flex justify-center">
            <button className="flex items-center gap-2 px-6 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-all">
              Load previous notifications
              <ChevronDown className="size-5" />
            </button>
          </div>
        )}
      </main>

      {/* Notification Preferences Mini-footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 py-6 px-4 md:px-10">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Want to change how you get these?
          </p>
          <div className="flex gap-4">
            <button className="text-red-600 text-sm font-bold flex items-center gap-1 hover:underline">
              <BellIcon className="size-4" />
              Push Settings
            </button>
            <button className="text-red-600 text-sm font-bold flex items-center gap-1 hover:underline">
              <Mail className="size-4" />
              Email Preferences
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

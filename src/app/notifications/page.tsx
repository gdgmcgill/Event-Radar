"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { NotificationList } from "@/components/notifications/NotificationList";
import type { Notification } from "@/components/notifications/NotificationItem";
import { SignInButton } from "@/components/auth/SignInButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCheck, LogIn, RefreshCcw, AlertCircle } from "lucide-react";

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    } catch {
      // Revert on failure
      fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      await fetch("/api/notifications?action=mark-all-read", { method: "POST" });
    } catch {
      fetchNotifications();
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Page Header */}
      <section className="w-full pt-12 pb-8 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
                  <Bell className="h-5 w-5" />
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  Notifications
                </h1>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-2 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-lg">
                Stay updated on your events and reminders.
              </p>
            </div>
            {user && unreadCount > 0 && (
              <Button
                variant="outline"
                onClick={handleMarkAllRead}
                className="gap-2 rounded-xl hidden sm:flex"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        {authLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-card rounded-2xl border border-border p-8">
            <div className="rounded-full bg-primary/10 p-4">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Sign in to view notifications</h3>
            <p className="text-muted-foreground max-w-md">
              You need to be signed in to receive and view notifications.
            </p>
            <SignInButton variant="default" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-card rounded-2xl border border-destructive/20 p-8">
            <div className="rounded-full bg-destructive/10 p-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-foreground">Something went wrong</h3>
              <p className="text-muted-foreground">{error}</p>
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
          <>
            {/* Mobile mark-all-read button */}
            {unreadCount > 0 && (
              <div className="sm:hidden mb-4">
                <Button
                  variant="outline"
                  onClick={handleMarkAllRead}
                  className="gap-2 rounded-xl w-full"
                >
                  <CheckCheck className="h-4 w-4" />
                  Mark all read
                </Button>
              </div>
            )}
            <NotificationList
              notifications={notifications}
              onMarkRead={handleMarkRead}
            />
          </>
        )}
      </div>
    </div>
  );
}

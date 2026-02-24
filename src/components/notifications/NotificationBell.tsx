"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) return;
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      } catch {
        // Silently fail - bell just won't show count
      }
    };

    fetchCount();
    // Poll every 60 seconds for new notifications
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      href="/notifications"
      className="relative p-2 rounded-lg hover:bg-muted transition-colors text-foreground hover:text-primary"
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold min-w-[18px] h-[18px] px-1"
          )}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

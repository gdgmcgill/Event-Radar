"use client";

import { useState, useEffect, useCallback } from "react";

/** Custom event name used to sync notification count across components */
const SYNC_EVENT = "notifications:count-changed";

/** Dispatch a sync event so all consumers of useNotificationCount refresh */
export function notifyCountChanged() {
  window.dispatchEvent(new Event(SYNC_EVENT));
}

export function useNotificationCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/count");
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unread_count || 0);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60000);

    // Listen for cross-component sync events
    window.addEventListener(SYNC_EVENT, fetchCount);

    return () => {
      clearInterval(interval);
      window.removeEventListener(SYNC_EVENT, fetchCount);
    };
  }, [fetchCount]);

  return unreadCount;
}

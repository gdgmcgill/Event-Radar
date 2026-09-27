"use client";

import { useState, useEffect, useCallback } from "react";

/** Custom event name used to sync notification count across components */
const SYNC_EVENT = "notifications:count-changed";

/** Dispatch a sync event so all consumers of useNotificationCount refresh */
export function notifyCountChanged() {
  window.dispatchEvent(new Event(SYNC_EVENT));
}

export interface UseNotificationCountOptions {
  /**
   * When false the hook neither fetches nor polls, and reports 0. The count
   * route answers an anonymous caller 401 (F-028, DEC-69), so a caller that
   * knows no user is signed in passes `enabled: false`. Defaults to true.
   */
  enabled?: boolean;
}

export function useNotificationCount({
  enabled = true,
}: UseNotificationCountOptions = {}) {
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
    if (!enabled) return;
    fetchCount(); // eslint-disable-line react-hooks/set-state-in-effect -- fetch on mount
    const interval = setInterval(fetchCount, 60000);

    // Listen for cross-component sync events
    window.addEventListener(SYNC_EVENT, fetchCount);

    return () => {
      clearInterval(interval);
      window.removeEventListener(SYNC_EVENT, fetchCount);
    };
  }, [fetchCount, enabled]);

  return enabled ? unreadCount : 0;
}

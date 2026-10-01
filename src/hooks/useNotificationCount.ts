"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  NotificationCountResponse,
  NotificationCountResponseBody,
} from "@/contracts/notifications";
import { checkResponseInDev } from "@/lib/contractCheck";

/** Custom event name used to sync notification count across components */
const SYNC_EVENT = "notifications:count-changed";

/** Dispatch a sync event so all consumers of useNotificationCount refresh */
export function notifyCountChanged() {
  window.dispatchEvent(new Event(SYNC_EVENT));
}

/**
 * Development only: check the count against its contract (plan 06-11,
 * REFAC-16). Module-level, outside the hook, so the hook body holds no
 * dynamic import; in a production build the branch, and the import with it,
 * is removed.
 */
function checkCountInDev(json: unknown) {
  if (process.env.NODE_ENV !== "production") {
    void checkResponseInDev(
      "GET /api/notifications/count",
      (): Promise<typeof NotificationCountResponse> =>
        import("@/contracts/notifications").then(
          (m) => m.NotificationCountResponse
        ),
      json
    );
  }
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
      const data: NotificationCountResponseBody = await res.json();
      checkCountInDev(data);
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

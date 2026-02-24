"use client";

import { useState, useEffect } from "react";

/**
 * Hook to fetch the set of saved event IDs for the current user.
 * Used to show the correct initial heart state on EventCards.
 */
export function useSavedEvents(enabled: boolean) {
  const [savedEventIds, setSavedEventIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setSavedEventIds(new Set());
      setIsLoading(false);
      return;
    }

    const fetchSaved = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/users/saved-events");
        if (!res.ok) return;
        const data = await res.json();
        setSavedEventIds(new Set(data.savedEventIds || []));
      } catch {
        // Silently fail - hearts just won't show initial saved state
      } finally {
        setIsLoading(false);
      }
    };

    fetchSaved();
  }, [enabled]);

  return { savedEventIds, isLoading };
}

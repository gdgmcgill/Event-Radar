"use client";

import { useState, useEffect } from "react";
import type { FeaturedEvent } from "@/types";
import type { FeaturedEventsResponse } from "@/contracts/events";
import { checkResponseInDev } from "@/lib/contractCheck";

/**
 * Development only: check the response against its contract (plan 06-11,
 * REFAC-16). Module-level, outside the hook, so the hook body holds no
 * dynamic import; in a production build the branch, and the import with it,
 * is removed.
 */
function checkFeaturedInDev(json: unknown) {
  if (process.env.NODE_ENV !== "production") {
    void checkResponseInDev(
      "GET /api/events/featured",
      (): Promise<typeof FeaturedEventsResponse> =>
        import("@/contracts/events").then((m) => m.FeaturedEventsResponse),
      json
    );
  }
}

export function useFeaturedEvents() {
  const [featured, setFeatured] = useState<FeaturedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await fetch("/api/events/featured");
        if (!res.ok) return;
        const data = await res.json();
        checkFeaturedInDev(data);
        setFeatured(data.featured ?? []);
      } catch {
        // Silently fail — hero shows branded fallback
      } finally {
        setIsLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  return { featured, isLoading };
}

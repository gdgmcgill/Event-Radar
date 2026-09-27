"use client";

import { useState, useEffect } from "react";
import type { FeaturedClub } from "@/types";
import type { FeaturedClubsResponse } from "@/contracts/clubs";
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
      "GET /api/clubs/featured",
      (): Promise<typeof FeaturedClubsResponse> =>
        import("@/contracts/clubs").then((m) => m.FeaturedClubsResponse),
      json
    );
  }
}

export function useFeaturedClubs() {
  const [featured, setFeatured] = useState<FeaturedClub[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await fetch("/api/clubs/featured");
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

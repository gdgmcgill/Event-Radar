"use client";

import { useState, useEffect } from "react";
import type { FeaturedClub } from "@/types";

export function useFeaturedClubs() {
  const [featured, setFeatured] = useState<FeaturedClub[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await fetch("/api/clubs/featured");
        if (!res.ok) return;
        const data = await res.json();
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

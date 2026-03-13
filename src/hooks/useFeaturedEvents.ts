"use client";

import { useState, useEffect } from "react";
import type { FeaturedEvent } from "@/types";

export function useFeaturedEvents() {
  const [featured, setFeatured] = useState<FeaturedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await fetch("/api/events/featured");
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

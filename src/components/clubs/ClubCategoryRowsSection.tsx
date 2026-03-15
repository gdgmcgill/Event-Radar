"use client";

import { useState, useEffect, useMemo } from "react";
import { ClubDiscoveryCard } from "@/components/clubs/ClubDiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";

type ClubWithCounts = {
  id: string;
  name: string;
  logo_url: string | null;
  category: string | null;
  follower_count: number;
  upcoming_event_count: number;
};

export function ClubCategoryRowsSection() {
  const [clubs, setClubs] = useState<ClubWithCounts[]>([]);

  useEffect(() => {
    const fetchClubs = async () => {
      try {
        const res = await fetch("/api/clubs/trending?limit=100");
        if (!res.ok) return;
        const data = await res.json();
        setClubs(data.clubs ?? []);
      } catch {
        // Non-critical
      }
    };
    fetchClubs();
  }, []);

  const clubsByCategory = useMemo(() => {
    const map = new Map<string, ClubWithCounts[]>();
    for (const club of clubs) {
      if (!club.category) continue;
      const list = map.get(club.category) ?? [];
      list.push(club);
      map.set(club.category, list);
    }
    return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [clubs]);

  if (clubsByCategory.size === 0) return null;

  return (
    <>
      {Array.from(clubsByCategory.entries()).map(([category, categoryClubs]) => (
        <section key={category}>
          <div className="flex items-center justify-between px-6 md:px-10 lg:px-12 mb-5">
            <h3 className="text-2xl font-extrabold text-foreground tracking-tight">
              {category}
              <span className="text-sm font-medium text-muted-foreground ml-3">
                {categoryClubs.length} club{categoryClubs.length !== 1 ? "s" : ""}
              </span>
            </h3>
          </div>
          <ScrollRow className="px-6 md:px-10 lg:px-12">
            {categoryClubs.map((club) => (
              <div key={club.id} className="min-w-[260px] sm:min-w-[280px] md:min-w-[320px] w-[calc(85vw-2rem)] sm:w-[300px] md:w-[340px] lg:w-[320px] flex-shrink-0">
                <ClubDiscoveryCard club={club} />
              </div>
            ))}
          </ScrollRow>
        </section>
      ))}
    </>
  );
}

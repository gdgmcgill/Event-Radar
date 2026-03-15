"use client";

import { useState, useEffect, useMemo } from "react";
import { ClubDiscoveryCard } from "@/components/clubs/ClubDiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";
import {
  SectionHeader,
  CARD_WRAPPER_CLASS,
  SECTION_PADDING,
} from "@/components/ui/SectionRow";

type ClubWithCounts = {
  id: string;
  name: string;
  logo_url: string | null;
  banner_url: string | null;
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
          <SectionHeader title={category} count={categoryClubs.length} countLabel="club" />
          <ScrollRow className={SECTION_PADDING}>
            {categoryClubs.map((club) => (
              <div key={club.id} className={CARD_WRAPPER_CLASS}>
                <ClubDiscoveryCard club={club} />
              </div>
            ))}
          </ScrollRow>
        </section>
      ))}
    </>
  );
}

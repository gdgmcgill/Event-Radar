"use client";

import { useState, useEffect } from "react";
import { ClubDiscoveryCard } from "@/components/clubs/ClubDiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";
import {
  SectionHeader,
  CARD_WRAPPER_CLASS,
  SECTION_PADDING,
} from "@/components/ui/SectionRow";

type NewClub = {
  id: string;
  name: string;
  logo_url: string | null;
  banner_url: string | null;
  follower_count: number;
  upcoming_event_count: number;
  total_event_count?: number;
};

export function NewClubsSection() {
  const [clubs, setClubs] = useState<NewClub[]>([]);

  useEffect(() => {
    const fetchNew = async () => {
      try {
        const res = await fetch("/api/clubs/new");
        if (!res.ok) return;
        const data = await res.json();
        setClubs(data.clubs ?? []);
      } catch {
        // Non-critical
      }
    };
    fetchNew();
  }, []);

  if (clubs.length === 0) return null;

  return (
    <section>
      <SectionHeader title="New on UNI-VERSE" count={clubs.length} countLabel="club" />
      <ScrollRow className={SECTION_PADDING}>
        {clubs.map((club) => (
          <div key={club.id} className={CARD_WRAPPER_CLASS}>
            <ClubDiscoveryCard club={club} />
          </div>
        ))}
      </ScrollRow>
    </section>
  );
}

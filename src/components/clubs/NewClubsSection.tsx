"use client";

import { useState, useEffect } from "react";
import { ClubDiscoveryCard } from "@/components/clubs/ClubDiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";

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
      <div className="flex items-center justify-between px-6 md:px-10 lg:px-12 mb-5">
        <h3 className="text-2xl font-extrabold text-foreground tracking-tight">
          New on UNI-VERSE
        </h3>
      </div>
      <ScrollRow className="px-6 md:px-10 lg:px-12">
        {clubs.map((club) => (
          <div key={club.id} className="min-w-[260px] sm:min-w-[280px] md:min-w-[320px] w-[calc(85vw-2rem)] sm:w-[300px] md:w-[340px] lg:w-[320px] flex-shrink-0">
            <ClubDiscoveryCard club={club} />
          </div>
        ))}
      </ScrollRow>
    </section>
  );
}

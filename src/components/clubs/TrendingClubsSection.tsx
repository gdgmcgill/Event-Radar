"use client";

import { useState, useEffect } from "react";
import { Flame } from "lucide-react";
import { ClubDiscoveryCard } from "@/components/clubs/ClubDiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";
import {
  SectionHeader,
  SectionSkeleton,
  SectionError,
  CARD_WRAPPER_CLASS,
  SECTION_PADDING,
} from "@/components/ui/SectionRow";

type TrendingClub = {
  id: string;
  name: string;
  logo_url: string | null;
  banner_url: string | null;
  follower_count: number;
  upcoming_event_count: number;
};

export function TrendingClubsSection() {
  const [clubs, setClubs] = useState<TrendingClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrending = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/clubs/trending");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setClubs(data.clubs ?? []);
    } catch {
      setError("Failed to load trending clubs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrending();
  }, []);

  const header = (
    <SectionHeader
      title="Trending Clubs"
      icon={<Flame className="h-6 w-6 text-orange-500" />}
      count={clubs.length}
      countLabel="club"
    />
  );

  if (loading && clubs.length === 0) {
    return <SectionSkeleton header={header} />;
  }

  if (error) {
    return <SectionError message={error} onRetry={fetchTrending} />;
  }

  if (clubs.length === 0) return null;

  return (
    <section>
      {header}
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

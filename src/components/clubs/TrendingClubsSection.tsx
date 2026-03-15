"use client";

import { useState, useEffect } from "react";
import { Flame, AlertCircle, RefreshCcw } from "lucide-react";
import { ClubDiscoveryCard } from "@/components/clubs/ClubDiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";
import { Button } from "@/components/ui/button";

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

  if (loading && clubs.length === 0) {
    return (
      <section>
        <div className="flex items-center justify-between px-6 md:px-10 lg:px-12 mb-5">
          <h3 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-500" />
            Trending Clubs
          </h3>
        </div>
        <div className="flex px-6 md:px-10 lg:px-12 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[260px] sm:min-w-[280px] md:min-w-[320px] w-[calc(85vw-2rem)] sm:w-[300px] md:w-[340px] lg:w-[320px] aspect-[16/10] rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="px-6 md:px-10 lg:px-12">
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 bg-card rounded-2xl border border-destructive/20 p-6">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={fetchTrending} variant="outline" size="sm" className="gap-2 cursor-pointer">
            <RefreshCcw className="h-3 w-3" />
            Try Again
          </Button>
        </div>
      </section>
    );
  }

  if (clubs.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between px-6 md:px-10 lg:px-12 mb-5">
        <h3 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
          <Flame className="h-6 w-6 text-orange-500" />
          Trending Clubs
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

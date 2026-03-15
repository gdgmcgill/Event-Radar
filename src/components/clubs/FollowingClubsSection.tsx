"use client";

import { useState, useEffect } from "react";
import { Building2, Heart } from "lucide-react";
import { ClubDiscoveryCard } from "@/components/clubs/ClubDiscoveryCard";
import { useAuthStore } from "@/store/useAuthStore";
import { SectionHeader } from "@/components/ui/SectionRow";

type FollowedClub = {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  category: string | null;
  follower_count: number;
  upcoming_event_count: number;
  total_event_count?: number;
};

export function FollowingClubsSection() {
  const user = useAuthStore((s) => s.user);
  const [clubs, setClubs] = useState<FollowedClub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchFollowing = async () => {
      try {
        const res = await fetch("/api/user/following");
        if (!res.ok) return;
        const data = await res.json();
        // The API returns { following: [{ id, created_at, clubs: { ... } }] }
        const mapped: FollowedClub[] = (data.following ?? [])
          .filter((f: Record<string, unknown>) => f.clubs)
          .map((f: Record<string, unknown>) => {
            const c = f.clubs as Record<string, unknown>;
            return {
              id: c.id as string,
              name: c.name as string,
              logo_url: (c.logo_url as string) ?? null,
              description: (c.description as string) ?? null,
              category: (c.category as string) ?? null,
              follower_count: 0,
              upcoming_event_count: 0,
            };
          });
        setClubs(mapped);
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    };
    fetchFollowing();
  }, [user]);

  if (!user || loading) return null;

  if (clubs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold">No clubs followed yet</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Follow clubs to see them here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Clubs You Follow"
        icon={<Heart className="h-6 w-6 text-primary" />}
        count={clubs.length}
        countLabel="club"
        noPadding
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clubs.map((club) => (
          <ClubDiscoveryCard key={club.id} club={club} />
        ))}
      </div>
    </div>
  );
}

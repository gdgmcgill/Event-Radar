"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { ClubDiscoveryCard } from "@/components/clubs/ClubDiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";
import { useAuthStore } from "@/store/useAuthStore";

type FriendClub = {
  id: string;
  name: string;
  logo_url: string | null;
  banner_url: string | null;
  follower_count: number;
  upcoming_event_count: number;
  friends_following: number;
};

export function PopularWithFriendsClubsSection() {
  const user = useAuthStore((s) => s.user);
  const [clubs, setClubs] = useState<FriendClub[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchFriendsClubs = async () => {
      try {
        const res = await fetch("/api/clubs/friends");
        if (!res.ok) return;
        const data = await res.json();
        setClubs(data.clubs ?? []);
      } catch {
        // Non-critical
      }
    };
    fetchFriendsClubs();
  }, [user]);

  if (!user || clubs.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between px-6 md:px-10 lg:px-12 mb-5">
        <h3 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Popular with Friends
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

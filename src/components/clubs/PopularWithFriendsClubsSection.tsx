"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { ClubDiscoveryCard } from "@/components/clubs/ClubDiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";
import { useAuthStore } from "@/store/useAuthStore";
import {
  SectionHeader,
  CARD_WRAPPER_CLASS,
  SECTION_PADDING,
} from "@/components/ui/SectionRow";

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
      <SectionHeader
        title="Popular with Friends"
        icon={<Users className="h-6 w-6 text-primary" />}
        count={clubs.length}
        countLabel="club"
      />
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

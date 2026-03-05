"use client";

import { useMyClubs } from "@/hooks/useClubs";
import { ClubCard } from "@/components/clubs/ClubCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Club } from "@/types";

interface MyClubEntry {
  id: string;
  role: "owner" | "organizer";
  created_at: string;
  club: Club;
  memberCount: number;
}

export function MyClubsList() {
  const { data, isLoading, error } = useMyClubs();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-center text-muted-foreground">
        Failed to load clubs. Please try again.
      </p>
    );
  }

  const clubs: MyClubEntry[] = data?.clubs ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {clubs.map((entry) => (
        <ClubCard
          key={entry.club.id}
          club={entry.club}
          role={entry.role}
          memberCount={entry.memberCount}
        />
      ))}
    </div>
  );
}

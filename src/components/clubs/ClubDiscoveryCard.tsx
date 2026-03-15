"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Calendar, Users, LayoutGrid, Heart } from "lucide-react";
import { ClubInitials } from "@/components/clubs/ClubInitials";
import { useAuthStore } from "@/store/useAuthStore";
import { useFollowedClubIds } from "@/hooks/useClubs";

interface ClubDiscoveryCardProps {
  club: {
    id: string;
    name: string;
    logo_url: string | null;
    banner_url?: string | null;
    follower_count: number;
    upcoming_event_count: number;
    total_event_count?: number;
  };
  initialFollowing?: boolean;
}

export function ClubDiscoveryCard({ club, initialFollowing = false }: ClubDiscoveryCardProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followerCount, setFollowerCount] = useState(club.follower_count);
  const [isLoading, setIsLoading] = useState(false);
  const user = useAuthStore((s) => s.user);
  const { followedIds, isLoading: followsLoading } = useFollowedClubIds();

  // Hydrate follow state from SWR data (covers page refresh)
  useEffect(() => {
    if (!followsLoading) {
      setIsFollowing(followedIds.has(club.id));
    }
  }, [followedIds, followsLoading, club.id]);

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      window.location.href = `/?signin=required&next=/clubs/${club.id}`;
      return;
    }

    setIsLoading(true);
    const wasFollowing = isFollowing;
    const prevCount = followerCount;
    setIsFollowing(!wasFollowing);
    setFollowerCount(wasFollowing ? prevCount - 1 : prevCount + 1);

    try {
      const res = await fetch(`/api/clubs/${club.id}/follow`, {
        method: wasFollowing ? "DELETE" : "POST",
      });
      if (!res.ok) throw new Error("Failed to toggle follow");
    } catch {
      setIsFollowing(wasFollowing);
      setFollowerCount(prevCount);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Link href={`/clubs/${club.id}`} className="block cursor-pointer">
      <div className="relative rounded-2xl overflow-hidden group bg-card border border-border shadow-sm hover:shadow-lg transition-shadow duration-300">
        {/* Banner Background */}
        <div className="relative h-24 w-full overflow-hidden bg-gradient-to-br from-primary/10 via-secondary/40 to-primary/5">
          {club.banner_url ? (
            <>
              <Image
                src={club.banner_url}
                alt=""
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/30" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-secondary/30 to-primary/12" />
          )}

          {/* Follow Button — top right corner over banner */}
          <button
            onClick={handleFollowToggle}
            disabled={isLoading}
            className={`absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md transition-all duration-200 cursor-pointer ${
              isFollowing
                ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                : "bg-white/80 dark:bg-black/50 text-foreground shadow-sm hover:bg-white dark:hover:bg-black/70 border border-white/20"
            }`}
          >
            <Heart
              className={`h-3.5 w-3.5 transition-all duration-200 ${
                isFollowing ? "fill-primary-foreground" : ""
              }`}
            />
            {isFollowing ? "Following" : "Follow"}
          </button>
        </div>

        {/* Profile Picture — overlapping banner and body */}
        <div className="relative flex justify-center -mt-8 z-[1]">
          <div className="w-16 h-16 rounded-full border-[3px] border-card shadow-md overflow-hidden bg-card flex items-center justify-center shrink-0 ring-1 ring-border/30">
            {club.logo_url ? (
              <Image
                src={club.logo_url}
                alt={`${club.name} logo`}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            ) : (
              <ClubInitials name={club.name} className="w-full h-full rounded-full text-lg" />
            )}
          </div>
        </div>

        {/* Card Body */}
        <div className="px-4 pt-2 pb-4 text-center">
          {/* Club Name */}
          <h4 className="text-foreground font-bold text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors">
            {club.name}
          </h4>

          {/* Stats Row */}
          <div className="flex items-center justify-center gap-3 mt-2 text-muted-foreground">
            <span className="flex items-center gap-1 text-xs">
              <Users className="h-3 w-3" />
              {followerCount}
            </span>
            {(club.total_event_count ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <LayoutGrid className="h-3 w-3" />
                {club.total_event_count}
              </span>
            )}
            {club.upcoming_event_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-primary font-medium">
                <Calendar className="h-3 w-3" />
                {club.upcoming_event_count} upcoming
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

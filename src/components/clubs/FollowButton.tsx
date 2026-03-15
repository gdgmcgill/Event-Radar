"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useFollowedClubIds } from "@/hooks/useClubs";

interface FollowButtonProps {
  clubId: string;
  initialFollowing: boolean;
  initialCount: number;
}

export function FollowButton({
  clubId,
  initialFollowing,
  initialCount,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followerCount, setFollowerCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const user = useAuthStore((s) => s.user);
  const { followedIds, isLoading: followsLoading } = useFollowedClubIds();

  // Hydrate follow state from SWR data (covers page refresh)
  useEffect(() => {
    if (!followsLoading) {
      setIsFollowing(followedIds.has(clubId));
    }
  }, [followedIds, followsLoading, clubId]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      // Redirect to sign-in with return URL
      window.location.href = `/?signin=required&next=/clubs/${clubId}`;
      return;
    }

    setIsLoading(true);

    // Optimistic update
    const wasFollowing = isFollowing;
    const prevCount = followerCount;
    setIsFollowing(!wasFollowing);
    setFollowerCount(wasFollowing ? prevCount - 1 : prevCount + 1);

    try {
      const res = await fetch(`/api/clubs/${clubId}/follow`, {
        method: wasFollowing ? "DELETE" : "POST",
      });
      if (!res.ok) throw new Error("Failed to toggle follow");
    } catch {
      // Revert on error
      setIsFollowing(wasFollowing);
      setFollowerCount(prevCount);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={isLoading}
      className={cn(
        "gap-2 transition-all duration-200 cursor-pointer",
        isFollowing
          ? "text-[#ED1B2F] hover:text-[#ED1B2F]/80"
          : "text-muted-foreground hover:text-[#ED1B2F]"
      )}
    >
      <Heart
        className={cn(
          "h-5 w-5 transition-all duration-200",
          isFollowing && "fill-[#ED1B2F]"
        )}
      />
      <span className="font-medium">
        {isFollowing ? "Following" : "Follow"}
      </span>
      <span className="text-sm text-muted-foreground">
        {followerCount}
      </span>
    </Button>
  );
}

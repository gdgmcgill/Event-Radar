"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Heart, UserCheck, UserMinus, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

interface FollowButtonProps {
  clubId: string;
  initialIsFollowing: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
}

export function FollowButton({
  clubId,
  initialIsFollowing,
  onFollowChange,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { user } = useAuthStore();
  const router = useRouter();

  async function handleToggle() {
    if (!user) {
      router.push("/auth/signin");
      return;
    }

    if (loading) return;

    // Optimistic update
    const nextState = !isFollowing;
    setIsFollowing(nextState);
    onFollowChange?.(nextState);
    setLoading(true);

    try {
      const method = isFollowing ? "DELETE" : "POST";
      const res = await fetch(`/api/clubs/${clubId}/follow`, { method });
      if (!res.ok) {
        // Revert on error
        setIsFollowing(isFollowing);
        onFollowChange?.(isFollowing);
      }
    } catch {
      // Revert on error
      setIsFollowing(isFollowing);
      onFollowChange?.(isFollowing);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {isFollowing ? "Following" : "Follow"}
      </Button>
    );
  }

  if (isFollowing) {
    return (
      <Button
        variant="outline"
        onClick={handleToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isHovered ? (
          <>
            <UserMinus className="mr-2 h-4 w-4" />
            Unfollow
          </>
        ) : (
          <>
            <UserCheck className="mr-2 h-4 w-4" />
            Following
          </>
        )}
      </Button>
    );
  }

  return (
    <Button variant="default" onClick={handleToggle}>
      <Heart className="mr-2 h-4 w-4" />
      Follow
    </Button>
  );
}

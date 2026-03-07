"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Users, Loader2 } from "lucide-react";

type FollowUserButtonProps = {
  userId: string;
  initialFollowing: boolean;
  initialIsFriend: boolean;
};

export default function FollowUserButton({
  userId,
  initialFollowing,
  initialIsFriend,
}: FollowUserButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [isFriend, setIsFriend] = useState(initialIsFriend);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const method = following ? "DELETE" : "POST";

    // Optimistic update
    if (following) {
      setFollowing(false);
      setIsFriend(false);
    } else {
      setFollowing(true);
    }

    try {
      const res = await fetch(`/api/users/${userId}/follow`, { method });
      const data = await res.json();

      if (!res.ok) {
        // Revert on error
        setFollowing(following);
        setIsFriend(isFriend);
        return;
      }

      setFollowing(data.following);
      setIsFriend(data.isFriend);
    } catch {
      // Revert on error
      setFollowing(following);
      setIsFriend(isFriend);
    } finally {
      setLoading(false);
    }
  };

  if (isFriend) {
    return (
      <Button variant="outline" size="sm" onClick={handleClick} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
        Friends
      </Button>
    );
  }

  if (following) {
    return (
      <Button variant="outline" size="sm" onClick={handleClick} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
        Following
      </Button>
    );
  }

  return (
    <Button size="sm" onClick={handleClick} disabled={loading} className="gap-2 bg-[#ED1B2F] hover:bg-[#ED1B2F]/90 text-white">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
      Follow
    </Button>
  );
}

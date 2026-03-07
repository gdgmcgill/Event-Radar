"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";

type FriendInfo = { id: string; name: string; avatar_url: string | null };

export function FriendsGoing({ eventId }: { eventId: string }) {
  const [friends, setFriends] = useState<FriendInfo[]>([]);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/friends`);
        if (!res.ok) return;
        const data = await res.json();
        setFriends(data.friends ?? []);
      } catch {
        // Non-critical
      }
    };

    fetchFriends();
  }, [eventId]);

  if (friends.length === 0) return null;

  const displayFriends = friends.slice(0, 3);
  const remaining = friends.length - displayFriends.length;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Users className="h-4 w-4 shrink-0" />
      <div className="flex -space-x-2">
        {displayFriends.map((friend) =>
          friend.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={friend.id}
              src={friend.avatar_url}
              alt={friend.name}
              className="h-6 w-6 rounded-full ring-2 ring-background object-cover"
            />
          ) : (
            <div
              key={friend.id}
              className="h-6 w-6 rounded-full ring-2 ring-background bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary"
            >
              {(friend.name ?? "U").charAt(0).toUpperCase()}
            </div>
          )
        )}
      </div>
      <span>
        {friends.length === 1
          ? `${friends[0].name} is going`
          : remaining > 0
            ? `${displayFriends.map((f) => f.name).join(", ")} +${remaining} going`
            : `${friends.map((f) => f.name).join(" & ")} are going`}
      </span>
    </div>
  );
}

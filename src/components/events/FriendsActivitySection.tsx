"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar } from "lucide-react";

type FriendInfo = { id: string; name: string; avatar_url: string | null };

type FriendEvent = {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  image_url: string | null;
  friends_going: FriendInfo[];
  friends_count: number;
};

export function FriendsActivitySection() {
  const [events, setEvents] = useState<FriendEvent[]>([]);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch("/api/events/friends-activity");
        if (!res.ok) return;
        const data = await res.json();
        setEvents(data.events ?? []);
      } catch {
        // Non-critical
      }
    };

    fetchActivity();
  }, []);

  if (events.length === 0) return null;

  return (
    <Card className="border-primary/10 bg-gradient-to-br from-primary/[0.02] to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Popular with Friends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="group flex flex-col rounded-xl border bg-card hover:bg-accent/50 transition-colors overflow-hidden"
            >
              {event.image_url && (
                <div className="h-28 w-full overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <div className="p-3 space-y-2">
                <p className="font-medium text-sm truncate">{event.title}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(event.event_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  {event.location && ` · ${event.location}`}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex -space-x-1.5">
                    {event.friends_going.slice(0, 3).map((friend) =>
                      friend.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={friend.id}
                          src={friend.avatar_url}
                          alt={friend.name}
                          className="h-5 w-5 rounded-full ring-2 ring-card object-cover"
                        />
                      ) : (
                        <div
                          key={friend.id}
                          className="h-5 w-5 rounded-full ring-2 ring-card bg-primary/10 flex items-center justify-center text-[8px] font-semibold text-primary"
                        >
                          {(friend.name ?? "U").charAt(0).toUpperCase()}
                        </div>
                      )
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {event.friends_count} friends going
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

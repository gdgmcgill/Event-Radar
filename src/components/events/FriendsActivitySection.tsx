"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Calendar, MapPin } from "lucide-react";

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
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Popular with Friends
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Events your friends are going to
          </p>
        </div>
      </div>

      {/* Event Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            className="group flex flex-col rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer"
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
            <div className="p-3.5 space-y-2.5">
              <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                {event.title}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary/60" />
                  {new Date(event.event_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                {event.location && (
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <MapPin className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5 pt-1 border-t border-border/30">
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
                <span className="text-xs text-muted-foreground font-medium">
                  {event.friends_count} friend{event.friends_count !== 1 ? "s" : ""} going
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

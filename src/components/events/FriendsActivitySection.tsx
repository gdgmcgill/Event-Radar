"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Users } from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils";
import { ScrollRow } from "@/components/events/ScrollRow";
import {
  SectionHeader,
  CARD_WRAPPER_CLASS,
  SECTION_PADDING,
} from "@/components/ui/SectionRow";

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
    <section>
      <SectionHeader
        title="Friends Are Going"
        icon={<Users className="h-6 w-6 text-primary" />}
        count={events.length}
      />
      <ScrollRow className={SECTION_PADDING}>
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            className={`${CARD_WRAPPER_CLASS} block cursor-pointer`}
          >
            <div className="relative aspect-[16/10] rounded-3xl overflow-hidden group">
              {event.image_url ? (
                <Image
                  src={event.image_url}
                  alt={event.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.08]"
                />
              ) : (
                <div className="w-full h-full bg-muted" />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

              <div className="absolute top-4 right-4">
                <span className="bg-white/90 text-slate-900 text-[10px] font-black px-2.5 py-1 rounded-md tracking-wider flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {event.friends_count} friend{event.friends_count !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="absolute bottom-0 left-0 p-5 w-full">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex -space-x-2">
                    {event.friends_going.slice(0, 3).map((friend) =>
                      friend.avatar_url ? (
                        <Image
                          key={friend.id}
                          src={friend.avatar_url}
                          alt={friend.name}
                          width={24}
                          height={24}
                          className="h-6 w-6 rounded-full ring-2 ring-background object-cover"
                        />
                      ) : (
                        <div
                          key={friend.id}
                          className="h-6 w-6 rounded-full ring-2 ring-background bg-primary/80 flex items-center justify-center text-[10px] font-bold text-white"
                        >
                          {(friend.name ?? "U").charAt(0).toUpperCase()}
                        </div>
                      )
                    )}
                  </div>
                  <span className="text-white/70 text-[10px] font-bold tracking-wide">
                    {event.friends_going
                      .slice(0, 2)
                      .map((f) => f.name.split(" ")[0])
                      .join(", ")}
                    {event.friends_count > 2 && ` +${event.friends_count - 2}`}
                  </span>
                </div>

                <h4 className="text-white font-extrabold text-lg leading-tight mb-1 line-clamp-2">
                  {event.title}
                </h4>
                <p className="text-white font-medium text-xs opacity-90">
                  {formatDate(event.event_date)}
                  {event.event_time && `, ${formatTime(event.event_time)}`}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </ScrollRow>
    </section>
  );
}

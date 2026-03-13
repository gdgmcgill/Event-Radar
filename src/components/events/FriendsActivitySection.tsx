"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Users, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showPrev, setShowPrev] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const updateButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowPrev(el.scrollLeft > 4);
    setShowNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateButtons();
    el.addEventListener("scroll", updateButtons, { passive: true });
    const ro = new ResizeObserver(updateButtons);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateButtons);
      ro.disconnect();
    };
  }, [events, updateButtons]);

  const scrollPrev = () =>
    scrollRef.current?.scrollBy({ left: -(scrollRef.current.clientWidth * 0.8), behavior: "smooth" });
  const scrollNext = () =>
    scrollRef.current?.scrollBy({ left: scrollRef.current.clientWidth * 0.8, behavior: "smooth" });

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
      <div className="flex items-center justify-between px-6 md:px-10 lg:px-12 mb-5">
        <h3 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Friends Are Going
        </h3>
      </div>
      <div className="relative group/row">
        {showPrev && (
          <button
            onClick={scrollPrev}
            className="absolute left-0 top-0 bottom-0 w-12 bg-white/70 dark:bg-black/40 backdrop-blur-sm text-foreground dark:text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-300 z-30 cursor-pointer rounded-r-md hover:bg-white/90 dark:hover:bg-black/70 hover:w-14"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto px-6 md:px-10 lg:px-12 gap-3 pb-4 scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="min-w-[260px] sm:min-w-[280px] md:min-w-[320px] w-[calc(85vw-2rem)] sm:w-[300px] md:w-[340px] lg:w-[320px] flex-shrink-0 block cursor-pointer"
            >
              <div className="relative aspect-[16/10] rounded-3xl overflow-hidden group">
                {/* Image */}
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

                {/* Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                {/* Friends badge */}
                <div className="absolute top-4 right-4">
                  <span className="bg-white/90 text-slate-900 text-[10px] font-black px-2.5 py-1 rounded-md tracking-wider flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {event.friends_count} friend{event.friends_count !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Content */}
                <div className="absolute bottom-0 left-0 p-5 w-full">
                  {/* Friend Avatars */}
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
        </div>
        {showNext && (
          <button
            onClick={scrollNext}
            className="absolute right-0 top-0 bottom-0 w-12 bg-white/70 dark:bg-black/40 backdrop-blur-sm text-foreground dark:text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-300 z-30 cursor-pointer rounded-l-md hover:bg-white/90 dark:hover:bg-black/70 hover:w-14"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        )}
      </div>
    </section>
  );
}

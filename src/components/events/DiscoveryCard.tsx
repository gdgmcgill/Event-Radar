"use client";

import Link from "next/link";
import Image from "next/image";
import { type Event } from "@/types";
import { formatDate, formatTime } from "@/lib/utils";

interface DiscoveryCardProps {
  event: Event;
  onClick?: () => void;
  badge?: string;
  badgeVariant?: "default" | "glass";
}

export function DiscoveryCard({ event, onClick, badge, badgeVariant = "default" }: DiscoveryCardProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <Link
      href={`/events/${event.id}`}
      onClick={handleClick}
      className="block cursor-pointer"
    >
      <div className="relative aspect-[16/10] rounded-3xl overflow-hidden group">
        {/* Full Image */}
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.08]"
          />
        ) : (
          <Image
            src="/placeholder-event.png"
            alt="No Image"
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.08]"
          />
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

        {/* Hover Glow */}
        <div className="absolute inset-0 shadow-[inset_0_0_25px_rgba(237,27,47,0.35)] opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none rounded-3xl" />

        {/* Badge (Live, Selling Fast, etc.) */}
        {badge && (
          <div className="absolute top-4 right-4">
            <span
              className={
                badgeVariant === "glass"
                  ? "bg-white/10 backdrop-blur-md text-white border border-white/20 text-[10px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase shadow-lg"
                  : "bg-primary text-white text-[10px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase shadow-lg"
              }
            >
              {badge}
            </span>
          </div>
        )}

        {/* Club PFP — top right, name pill drops below on hover */}
        {event.club && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/30 overflow-hidden flex-shrink-0 shadow-lg">
              {event.club.logo_url ? (
                <Image
                  src={event.club.logo_url}
                  alt={event.club.name}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-400 flex items-center justify-center text-white text-xs font-bold">
                  {event.club.name.charAt(0)}
                </div>
              )}
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-white text-[10px] font-bold tracking-wide uppercase whitespace-nowrap max-w-[180px] truncate opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none shadow-lg">
              {event.club.name}
            </span>
          </div>
        )}

        {/* Bottom Content */}
        <div className="absolute bottom-0 left-0 p-5 w-full">
          {/* Event Title */}
          <h4 className="text-white font-extrabold text-lg leading-tight mb-1 line-clamp-2">
            {event.title}
          </h4>

          {/* Date + Time */}
          <p className="text-white font-medium text-xs opacity-90">
            {formatDate(event.event_date)}, {formatTime(event.event_time)}
          </p>
        </div>
      </div>
    </Link>
  );
}

"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { EVENT_CATEGORIES, EVENT_TAGS } from "@/lib/constants";
import type { Event, EventTag } from "@/types";
import { formatDate, formatTime, cn } from "@/lib/utils";
import {
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
  Heart,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  LayoutGrid,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TAG_ICONS: Record<string, LucideIcon> = {
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
  Heart,
};

interface CategoryBrowserProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
}

export function CategoryBrowser({ events, onEventClick }: CategoryBrowserProps) {
  const [activeTag, setActiveTag] = useState<EventTag | "all">("all");

  const eventsByTag = useMemo(() => {
    const map = new Map<EventTag, Event[]>();
    for (const tag of EVENT_TAGS) {
      map.set(tag, []);
    }
    for (const event of events) {
      for (const tag of event.tags) {
        const list = map.get(tag);
        if (list) list.push(event);
      }
    }
    return map;
  }, [events]);

  const displayEvents = useMemo(() => {
    if (activeTag === "all") return events.slice(0, 9);
    return eventsByTag.get(activeTag as EventTag)?.slice(0, 9) ?? [];
  }, [activeTag, events, eventsByTag]);

  // Only show categories that have events
  const activeTags = EVENT_TAGS.filter(
    (tag) => (eventsByTag.get(tag)?.length ?? 0) > 0
  );

  if (activeTags.length === 0) return null;

  return (
    <section>
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
          <LayoutGrid className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Browse by Category
          </h2>
          <p className="text-sm text-muted-foreground">
            Explore events across all categories
          </p>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6" style={{ scrollbarWidth: "none" }}>
        <button
          onClick={() => setActiveTag("all")}
          className={cn(
            "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer",
            activeTag === "all"
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          All Events
        </button>
        {activeTags.map((tag) => {
          const category = EVENT_CATEGORIES[tag];
          const Icon = TAG_ICONS[category.icon] || Heart;
          const count = eventsByTag.get(tag)?.length ?? 0;

          return (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={cn(
                "flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer",
                activeTag === tag
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {category.label}
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded-full",
                activeTag === tag
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background text-muted-foreground"
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Event Grid */}
      {displayEvents.length === 0 ? (
        <div className="flex items-center justify-center h-48 rounded-2xl border border-dashed border-border/60 bg-muted/30">
          <p className="text-muted-foreground text-sm">No events in this category yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {displayEvents.map((event) => (
            <CategoryEventCard
              key={event.id}
              event={event}
              onEventClick={onEventClick}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Consistent Category Event Card ───────────────────────────────────────

interface CategoryEventCardProps {
  event: Event;
  onEventClick?: (event: Event) => void;
}

function CategoryEventCard({ event, onEventClick }: CategoryEventCardProps) {
  const primaryTag = event.tags[0];
  const category = primaryTag ? EVENT_CATEGORIES[primaryTag] : null;
  const Icon = category ? TAG_ICONS[category.icon] || Heart : Heart;

  return (
    <div
      className="group bg-card rounded-2xl border border-border/50 overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all duration-300 cursor-pointer"
      onClick={() => onEventClick?.(event)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onEventClick?.(event);
      }}
    >
      {/* Image */}
      <div className="relative h-36 overflow-hidden bg-muted">
        <Image
          src={event.image_url || "/placeholder-event.png"}
          alt={event.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Category badge */}
        {category && (
          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card/90 backdrop-blur-md text-xs font-semibold shadow-sm">
            <Icon className="h-3 w-3 text-primary" />
            <span className="text-foreground">{category.label}</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Content */}
      <div className="p-4">
        {event.club && (
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-1">
            {event.club.name}
          </p>
        )}
        <h4 className="font-bold text-sm leading-tight line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {event.title}
        </h4>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
            <span>{formatDate(event.event_date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
            <span>{formatTime(event.event_time)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
            <span className="line-clamp-1">{event.location}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
          <span className="text-xs font-medium text-muted-foreground">
            View details
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </div>
  );
}

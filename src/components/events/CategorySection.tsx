"use client";

import { EVENT_CATEGORIES } from "@/lib/constants";
import type { Event, EventTag } from "@/types";
import { EventCard } from "./EventCard";
import { HorizontalEventScroll } from "./HorizontalEventScroll";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
  Heart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
  Heart,
};

interface CategorySectionProps {
  tag: EventTag;
  events: Event[];
  onEventClick: (event: Event) => void;
  showSaveButton?: boolean;
  savedEventIds?: Set<string>;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export function CategorySection({
  tag,
  events,
  onEventClick,
  showSaveButton = false,
  savedEventIds = new Set(),
  hasMore = false,
  onLoadMore,
}: CategorySectionProps) {
  const category = EVENT_CATEGORIES[tag];
  const Icon = iconMap[category.icon] || Heart;

  return (
    <section className="space-y-4">
      {/* Category Header */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center h-10 w-10 rounded-xl ${category.color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{category.label}</h2>
          <p className="text-sm text-muted-foreground">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Events or Empty State */}
      {events.length === 0 ? (
        <div className="flex items-center justify-center h-48 rounded-2xl border border-dashed border-border/60 bg-card/30">
          <p className="text-muted-foreground text-sm">No events in this category yet</p>
        </div>
      ) : (
        <HorizontalEventScroll 
          onNearEnd={onLoadMore}
          hasMore={hasMore}
        >
          {events.map((event) => (
            <div
              key={event.id}
              className="snap-start shrink-0 w-[300px] sm:w-[340px]"
            >
              <EventCard
                event={event}
                onClick={() => onEventClick(event)}
                showSaveButton={showSaveButton}
                isSaved={savedEventIds.has(event.id)}
                trackingSource="home"
              />
            </div>
          ))}
        </HorizontalEventScroll>
      )}
    </section>
  );
}

export function CategorySectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-1">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <div className="flex gap-6 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="shrink-0 w-[300px] sm:w-[340px]">
            <Skeleton className="h-[380px] rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { type Event, type EventTag } from "@/types";
import { EVENT_CATEGORIES, EVENT_TAGS } from "@/lib/constants";
import { DiscoveryCard } from "@/components/events/DiscoveryCard";
import { ScrollRow } from "@/components/events/ScrollRow";
import {
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
  Heart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

const TAG_ICONS: Record<string, LucideIcon> = {
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
  Heart,
};

interface CategoryRowsSectionProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
}

export function CategoryRowsSection({ events, onEventClick }: CategoryRowsSectionProps) {
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

  // Only render rows for categories that have events
  const activeCategories = EVENT_TAGS.filter(
    (tag) => (eventsByTag.get(tag)?.length ?? 0) > 0
  );

  if (activeCategories.length === 0) return null;

  return (
    <>
      {activeCategories.map((tag) => {
        const category = EVENT_CATEGORIES[tag];
        const Icon = TAG_ICONS[category.icon] || Heart;
        const tagEvents = eventsByTag.get(tag) ?? [];

        return (
          <section key={tag}>
            <div className="flex items-center justify-between px-6 md:px-10 lg:px-12 mb-5">
              <h3 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
                <span
                  className="flex items-center justify-center h-8 w-8 rounded-lg"
                  style={{ backgroundColor: `${category.baseColor}20`, color: category.baseColor }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {category.label}
                <span className="text-sm font-medium text-muted-foreground">
                  {tagEvents.length} event{tagEvents.length !== 1 ? "s" : ""}
                </span>
              </h3>
              <Link
                href={`/categories?tag=${tag}`}
                className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                See All
              </Link>
            </div>
            <ScrollRow className="px-6 md:px-10 lg:px-12">
              {tagEvents.map((event) => (
                <div key={event.id} className="min-w-[260px] sm:min-w-[280px] md:min-w-[320px] w-[calc(85vw-2rem)] sm:w-[300px] md:w-[340px] lg:w-[320px] flex-shrink-0">
                  <DiscoveryCard
                    event={event}
                    onClick={onEventClick ? () => onEventClick(event) : undefined}
                  />
                </div>
              ))}
            </ScrollRow>
          </section>
        );
      })}
    </>
  );
}

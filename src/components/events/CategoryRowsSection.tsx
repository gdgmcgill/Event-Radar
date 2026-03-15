"use client";

import { useMemo } from "react";
import { type Event, EventTag } from "@/types";
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
import {
  SectionHeader,
  CARD_WRAPPER_CLASS,
  SECTION_PADDING,
} from "@/components/ui/SectionRow";

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
  onCategoryClick?: (tag: EventTag) => void;
}

export function CategoryRowsSection({ events, onEventClick, onCategoryClick }: CategoryRowsSectionProps) {
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

  // Display order for homepage category rows
  const categoryOrder: EventTag[] = [
    EventTag.CAREER,
    EventTag.ACADEMIC,
    EventTag.SOCIAL,
    EventTag.CULTURAL,
    EventTag.SPORTS,
    ...EVENT_TAGS.filter(
      (t) => ![EventTag.CAREER, EventTag.ACADEMIC, EventTag.SOCIAL, EventTag.CULTURAL, EventTag.SPORTS].includes(t)
    ),
  ];

  const activeCategories = categoryOrder.filter(
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
            <SectionHeader
              title={category.label}
              icon={
                <span
                  className="flex items-center justify-center h-8 w-8 rounded-lg"
                  style={{ backgroundColor: `${category.baseColor}20`, color: category.baseColor }}
                >
                  <Icon className="h-4 w-4" />
                </span>
              }
              count={tagEvents.length}
              action={
                onCategoryClick ? (
                  <button
                    onClick={() => onCategoryClick(tag)}
                    className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                  >
                    See All
                  </button>
                ) : undefined
              }
            />
            <ScrollRow className={SECTION_PADDING}>
              {tagEvents.map((event) => (
                <div key={event.id} className={CARD_WRAPPER_CLASS}>
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

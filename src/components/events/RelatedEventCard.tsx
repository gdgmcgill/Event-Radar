"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTimeFromISO } from "@/lib/utils";
import { EVENT_CATEGORIES } from "@/lib/constants";
import type { Event } from "@/types";

interface RelatedEventCardProps {
  event: Event;
}

export function RelatedEventCard({ event }: RelatedEventCardProps) {
  const displayTags = event.tags.slice(0, 2);

  return (
    <Link
      href={`/events/${event.id}`}
      className="flex flex-col gap-1.5 rounded-xl p-3 border transition-colors hover:bg-muted/60"
    >
      <p className="font-medium text-sm leading-tight line-clamp-1">{event.title}</p>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Calendar className="h-3 w-3 shrink-0" />
        <span className="truncate">{formatDate(event.start_date)} at {formatTimeFromISO(event.start_date)}</span>
      </div>
      {displayTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {displayTags.map((tag) => {
            const category = EVENT_CATEGORIES[tag];
            if (!category) return null;
            return (
              <Badge key={tag} variant="secondary" className={`text-xs px-1.5 py-0 ${category.color}`}>
                {category.label}
              </Badge>
            );
          })}
        </div>
      )}
    </Link>
  );
}

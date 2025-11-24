"use client";

/**
 * Event card component for displaying event previews
 * TODO: Add event image, styling, hover effects, and save button
 */

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/utils";
import { EVENT_CATEGORIES } from "@/lib/constants";
import type { Event } from "@/types";
import { Calendar, Clock, MapPin, Heart } from "lucide-react";

interface EventCardProps {
  event: Event;
  onClick?: () => void;
  showSaveButton?: boolean;
  isSaved?: boolean;
}

export function EventCard({
  event,
  onClick,
  showSaveButton = false,
  isSaved = false,
}: EventCardProps) {
  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // TODO: Implement save event logic
  };

  return (
    <Link href={`/events/${event.id}`}>
      <Card
        className="h-full cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
        onClick={onClick}
      >
        {/* TODO: Add event image with Next.js Image component */}
        <div className="relative h-48 w-full overflow-hidden rounded-t-lg bg-muted">
          {event.image_url ? (
            <Image
              src={event.image_url}
              alt={event.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No Image
            </div>
          )}
        </div>

        <CardHeader>
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold line-clamp-2">{event.title}</h3>
            {showSaveButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSave}
                className="ml-2"
              >
                <Heart
                  className={`h-5 w-5 ${isSaved ? "fill-red-500 text-red-500" : ""}`}
                />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {event.description}
          </p>

          <div className="space-y-2">
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="mr-2 h-4 w-4" />
              {formatDate(event.event_date)}
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="mr-2 h-4 w-4" />
              {formatTime(event.event_time)}
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <MapPin className="mr-2 h-4 w-4" />
              {event.location}
            </div>
            {event.club && (
              <div className="text-sm text-muted-foreground">
                By {event.club.name}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-wrap gap-2">
          {/* TODO: Add event tags as badges */}
          {event.tags.slice(0, 3).map((tag) => {
            const category = EVENT_CATEGORIES[tag];
            return (
              <Badge key={tag} variant="secondary" className={category.color}>
                {category.label}
              </Badge>
            );
          })}
        </CardFooter>
      </Card>
    </Link>
  );
}





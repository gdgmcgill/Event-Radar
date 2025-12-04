// src/components/events/EventCard.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/utils";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { type Event } from "@/types";
import { Calendar, Clock, MapPin, Heart } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

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
  isSaved: initialIsSaved = false,
}: EventCardProps) {
  const [isSaved, setIsSaved] = useState(initialIsSaved);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await fetch(`/api/events/${event.id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to save event");

      const data = await response.json();
      setIsSaved(data.saved);
    } catch (error) {
      console.error("Error saving event:", error);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <Link href={`/events/${event.id}`} onClick={handleCardClick} className="block h-full group">
      <Card className="h-full overflow-hidden border-none shadow-md transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 bg-card rounded-2xl flex flex-col">
        {/* Image Section */}
        <div className="relative h-52 w-full overflow-hidden bg-secondary/20">
          {event.image_url ? (
            <Image
              src={event.image_url}
              alt={event.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/40 bg-secondary/30">
              <Image
                src="/placeholder-event.png"
                alt="No Image"
                fill
                className="object-cover opacity-80 transition-transform duration-700 group-hover:scale-105"
              />
            </div>
          )}
          
          {/* Gradient Overlay for Text Readability if needed, mostly stylistic here */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 dark:from-white/6 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Floating Save Button */}
            {showSaveButton && (
            <Button
              variant="secondary"
              size="icon"
              onClick={handleSave}
              className={cn(
                "absolute top-3 right-3 h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border/40 transition-all duration-300 hover:scale-110",
                isSaved 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "bg-card/90 text-muted-foreground hover:text-primary hover:bg-card"
              )}
            >
              <Heart className={cn("h-4 w-4", isSaved && "fill-current")} />
            </Button>
          )}
        </div>

        {/* Content Section */}
        <div className="flex flex-col flex-grow p-5 gap-3">
          <div className="space-y-1">
            {event.club && (
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                {event.club.name}
              </p>
            )}
            <h3 className="text-lg font-bold leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {event.title}
            </h3>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {event.description}
          </p>

          <div className="mt-auto pt-4 space-y-2.5 text-sm text-muted-foreground/80 font-medium">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary/80" />
              <span>{formatDate(event.event_date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary/80" />
              <span>{formatTime(event.event_time)}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary/80" />
              <span className="line-clamp-1">{event.location}</span>
            </div>
          </div>
        </div>

        {/* Footer / Tags */}
        <div className="px-5 pb-5 pt-0 flex flex-wrap gap-2">
          {event.tags.slice(0, 3).map((tag) => {
            const category = EVENT_CATEGORIES[tag];
            return (
              <Badge 
                key={tag} 
                variant="secondary" 
                className={cn(
                  "px-2.5 py-0.5 text-xs font-medium transition-colors bg-secondary/50 text-secondary-foreground hover:bg-secondary",
                  // category?.color // Keeping it cleaner with consistent secondary styling
                )}
              >
                {category?.label || tag}
              </Badge>
            );
          })}
        </div>
      </Card>
    </Link>
  );
}

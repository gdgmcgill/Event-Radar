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
import { type Event, type InteractionSource, type EventPopularityScore } from "@/types";
import { Calendar, Clock, MapPin, Heart, X, ThumbsUp, ThumbsDown, TrendingUp, Flame, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTracking } from "@/hooks/useTracking";
import { exportEventIcal } from "@/lib/exportUtils";

interface EventCardProps {
  event: Event;
  onClick?: () => void;
  showSaveButton?: boolean;
  isSaved?: boolean;
  /** Tracking source context; "recommendation" enables thumbs & dismiss UI */
  trackingSource?: InteractionSource;
  /** 1-based rank in the recommendation list (for feedback) */
  recommendationRank?: number;
  /** Called when user clicks "Not interested"; remove card from list */
  onDismiss?: (eventId: string) => void;
  /** Initial thumbs state (from GET /api/recommendations/feedback) */
  initialThumbsFeedback?: "positive" | "negative" | null;
  /** Called after a successful save/unsave toggle */
  onSaveToggle?: (eventId: string, saved: boolean) => void;
  /** Why this event was recommended (shown below the card) */
  explanation?: string | null;
  /** Display rank badge (1, 2, 3) for popular events */
  rank?: 1 | 2 | 3;
  /** Show popularity stats overlay */
  showPopularityStats?: boolean;
  /** Popularity score data */
  popularity?: EventPopularityScore | null;
}

export function EventCard({
  event,
  onClick,
  showSaveButton = false,
  isSaved: initialIsSaved = false,
  trackingSource,
  recommendationRank = 1,
  onDismiss,
  onSaveToggle,
  explanation,
  initialThumbsFeedback = null,
  rank,
  showPopularityStats,
  popularity,
}: EventCardProps) {
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [thumbsFeedback, setThumbsFeedback] = useState<"positive" | "negative" | null>(initialThumbsFeedback ?? null);
  const [isExportingCal, setIsExportingCal] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const impressionSent = useRef(false);
  const {
    trackRecommendationDismiss,
    trackRecommendationClick,
    trackRecommendationImpression,
    trackRecommendationSave,
    submitThumbsFeedback,
  } = useTracking();

  // Sync initial thumbs when prop changes (e.g. after fetch)
  useEffect(() => {
    setThumbsFeedback(initialThumbsFeedback ?? null);
  }, [initialThumbsFeedback]);

  // Fire impression once when recommendation card is visible
  useEffect(() => {
    if (
      trackingSource !== "recommendation" ||
      recommendationRank < 1 ||
      impressionSent.current
    )
      return;
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || impressionSent.current) return;
        impressionSent.current = true;
        trackRecommendationImpression(event.id, recommendationRank);
      },
      { threshold: 0.2, rootMargin: "0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [
    trackingSource,
    recommendationRank,
    event.id,
    trackRecommendationImpression,
  ]);

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
      onSaveToggle?.(event.id, data.saved);
      if (
        data.saved &&
        trackingSource === "recommendation" &&
        recommendationRank >= 1
      ) {
        trackRecommendationSave(event.id, recommendationRank);
      }
    } catch (error) {
      console.error("Error saving event:", error);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (trackingSource === "recommendation" && recommendationRank >= 1) {
      trackRecommendationClick(event.id, recommendationRank);
    }
    if (onClick) {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (trackingSource === "recommendation" && recommendationRank >= 1) {
      trackRecommendationDismiss(event.id, recommendationRank);
    }
    onDismiss?.(event.id);
  };

  const handleThumbs = async (e: React.MouseEvent, feedback: "positive" | "negative") => {
    e.preventDefault();
    e.stopPropagation();
    if (trackingSource !== "recommendation") return;
    const prev = thumbsFeedback;
    setThumbsFeedback(feedback);
    try {
      await submitThumbsFeedback(event.id, feedback);
    } catch {
      setThumbsFeedback(prev);
    }
  };

  const handleExportCalendar = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setIsExportingCal(true);
      await exportEventIcal(event.id, event.title);
    } catch {
      // Error already logged in exportUtils
    } finally {
      setIsExportingCal(false);
    }
  };

  return (
    <div ref={cardRef} className="h-full">
    <Link href={`/events/${event.id}${trackingSource ? `?from=${trackingSource}` : ""}`} onClick={handleCardClick} className="block h-full group">
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

          {/* Popularity / Trending Badges — only for non-ranked cards */}
          {!rank && popularity && (popularity.trending_score > 0 || popularity.popularity_score > 0) && (
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              {popularity.trending_score >= 5 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500/90 text-white backdrop-blur-sm shadow-sm">
                  <Flame className="h-3 w-3" />
                  Trending
                </span>
              )}
              {popularity.popularity_score >= 10 && popularity.trending_score < 5 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/90 text-white backdrop-blur-sm shadow-sm">
                  <TrendingUp className="h-3 w-3" />
                  Popular
                </span>
              )}
            </div>
          )}

          {/* Floating Action Buttons */}
          <div className="absolute top-3 right-3 flex flex-col gap-2">

            <Button
              variant="secondary"
              size="icon"
              onClick={handleExportCalendar}
              disabled={isExportingCal}
              className={cn(
                "h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border/40 transition-all duration-300 hover:scale-110",
                "bg-card/90 text-muted-foreground hover:text-primary hover:bg-card"
              )}
              title="Export to Calendar"
            >
              {isExportingCal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
            </Button>
            {showSaveButton && (
              <Button
                variant="secondary"
                size="icon"
                onClick={handleSave}
                className={cn(
                  "h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border/40 transition-all duration-300 hover:scale-110",
                  isSaved
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-card/90 text-muted-foreground hover:text-primary hover:bg-card"
                )}
                title={isSaved ? "Unsave event" : "Save event"}
              >
                <Heart className={cn("h-4 w-4", isSaved && "fill-current")} />
              </Button>
            )}
          </div>
          {/* Not interested (recommendation cards only) */}
          {trackingSource === "recommendation" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="absolute bottom-3 left-3 h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-white/20 bg-white/80 text-muted-foreground hover:bg-destructive/90 hover:text-destructive-foreground transition-all duration-300 opacity-80 hover:opacity-100"
              aria-label="Not interested"
            >
              <X className="h-4 w-4" />
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

        {/* Footer / Tags + Thumbs (recommendation only) */}
        <div className="px-5 pb-5 pt-0 flex flex-wrap items-center gap-2">
          {event.tags.slice(0, 3).map((tag) => {
            const category = EVENT_CATEGORIES[tag];
            return (
              <Badge
                key={tag}
                variant="secondary"
                className={cn(
                  "px-2.5 py-0.5 text-xs font-medium transition-colors bg-secondary/50 text-secondary-foreground hover:bg-secondary"
                )}
              >
                {category?.label || tag}
              </Badge>
            );
          })}
          {trackingSource === "recommendation" && (
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => handleThumbs(e, "positive")}
                className={cn(
                  "h-8 w-8 rounded-full",
                  thumbsFeedback === "positive"
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-primary"
                )}
                aria-label="Thumbs up"
              >
                <ThumbsUp className={cn("h-4 w-4", thumbsFeedback === "positive" && "fill-current")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => handleThumbs(e, "negative")}
                className={cn(
                  "h-8 w-8 rounded-full",
                  thumbsFeedback === "negative"
                    ? "text-destructive bg-destructive/10"
                    : "text-muted-foreground hover:text-destructive"
                )}
                aria-label="Thumbs down"
              >
                <ThumbsDown className={cn("h-4 w-4", thumbsFeedback === "negative" && "fill-current")} />
              </Button>
            </div>
          )}
        </div>
      </Card>
      {explanation && (
        <p className="mt-1.5 px-1 text-xs text-muted-foreground/70 italic truncate">
          {explanation}
        </p>
      )}
    </Link>
    </div>
  );
}

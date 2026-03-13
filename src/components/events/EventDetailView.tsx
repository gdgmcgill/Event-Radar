// src/components/events/EventDetailView.tsx
"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EventBadge } from "@/components/events/EventBadge";
import { formatDate, formatTime, cn } from "@/lib/utils";
import { EVENT_CATEGORIES } from "@/lib/constants";
import type { Event, EventTag, ReviewAggregate } from "@/types";
import {
  Calendar,
  MapPin,
  Heart,
  Share2,
  Check,
  Star,
  ExternalLink,
  Twitter,
  Facebook,
  Link2,
} from "lucide-react";

interface EventDetailViewProps {
  event: Event;
  similarEvents?: Event[];
  isSaved?: boolean;
  onSave?: () => void;
  onShare?: (platform: string) => void;
  onEventClick?: (eventId: string) => void;
  reviews?: ReviewAggregate;
  /** Extra content rendered at the bottom of the left column (e.g. RSVP, reviews) */
  children?: React.ReactNode;
}

export function EventDetailView({
  event,
  similarEvents = [],
  isSaved = false,
  onSave,
  onShare,
  onEventClick,
  reviews,
  children,
}: EventDetailViewProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(isSaved);
  const eventUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/events/${event.id}`
      : `/events/${event.id}`;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      onShare?.("copy");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [eventUrl, onShare]);

  const handleNativeShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: event.title,
          text: event.description,
          url: eventUrl,
        });
        onShare?.("native");
      } else {
        handleCopyLink();
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.warn("Share failed:", err);
      }
    }
  }, [event.title, event.description, eventUrl, onShare, handleCopyLink]);

  const handleShareTwitter = useCallback(() => {
    const text = encodeURIComponent(`Check out "${event.title}" on Uni-Verse!`);
    const url = encodeURIComponent(eventUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
    onShare?.("twitter");
  }, [event.title, eventUrl, onShare]);

  const handleShareFacebook = useCallback(() => {
    const url = encodeURIComponent(eventUrl);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank");
    onShare?.("facebook");
  }, [eventUrl, onShare]);

  const handleSave = useCallback(() => {
    setSaved((prev) => !prev);
    onSave?.();
  }, [onSave]);

  const primaryTag = event.tags[0] as EventTag | undefined;
  const categoryInfo = primaryTag ? EVENT_CATEGORIES[primaryTag] : null;

  return (
    <div className="w-full">
      {/* Hero Section */}
      <div className="relative w-full aspect-[21/9] overflow-hidden rounded-xl mb-8">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover transition-transform duration-700 hover:scale-105"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#561c24] to-[#ED1B2F]" />
        )}
        <div className="absolute bottom-6 left-6 z-20 space-y-2">
          {primaryTag && categoryInfo && (
            <span className="bg-[#ED1B2F] text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-block">
              Featured {categoryInfo.label} Event
            </span>
          )}
          <h1 className="text-white text-3xl md:text-5xl font-black leading-tight tracking-tight drop-shadow-lg">
            {event.title}
          </h1>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column — Event Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Date, Time, Location */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-[#ED1B2F]/10 flex items-center justify-center text-[#ED1B2F]">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-slate-900 dark:text-slate-100 font-bold text-lg">
                  {formatDate(event.event_date)}
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  {formatTime(event.event_time)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-[#ED1B2F]/10 flex items-center justify-center text-[#ED1B2F]">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <p className="text-slate-900 dark:text-slate-100 font-bold text-lg">
                  {event.location}
                </p>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-500 dark:text-slate-400 hover:text-[#ED1B2F] transition-colors text-sm flex items-center gap-1"
                >
                  View on map
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          {/* About / Description */}
          <div className="flex flex-col gap-4 border-y border-[#ED1B2F]/10 py-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              About the event
            </h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {event.description || "No description provided."}
            </p>
            {/* Tags */}
            <div className="flex flex-wrap gap-2 pt-2">
              {event.tags.map((tag) => (
                <EventBadge key={tag} tag={tag} variant="glowing" />
              ))}
            </div>
          </div>

          {/* Organizer */}
          {event.club && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Organizer
              </h3>
              <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-white/5 border border-[#ED1B2F]/10">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-lg bg-[#ED1B2F]/20 flex items-center justify-center overflow-hidden">
                    {event.club.logo_url ? (
                      <Image
                        src={event.club.logo_url}
                        alt={event.club.name}
                        width={48}
                        height={48}
                        className="object-cover"
                      />
                    ) : (
                      <span className="font-bold text-[#ED1B2F] text-sm">
                        {event.club.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 4)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">
                      {event.club.name}
                    </p>
                    {event.club.category && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {event.club.category}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reviews */}
          {reviews && reviews.total_reviews > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Reviews
                </h3>
                <div className="flex items-center gap-1 text-[#ED1B2F]">
                  <Star className="h-5 w-5 fill-current" />
                  <span className="font-bold">
                    {reviews.average_rating.toFixed(1)}
                  </span>
                  <span className="text-slate-500 text-sm">
                    ({reviews.total_reviews} review{reviews.total_reviews !== 1 ? "s" : ""})
                  </span>
                </div>
              </div>
              {reviews.comments.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reviews.comments.slice(0, 4).map((review, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-[#ED1B2F]/5 border border-[#ED1B2F]/5"
                    >
                      <p className="italic text-sm text-slate-600 dark:text-slate-300">
                        &ldquo;{review.comment}&rdquo;
                      </p>
                      <div className="flex items-center gap-1 mt-2">
                        {Array.from({ length: review.rating }).map((_, i) => (
                          <Star
                            key={i}
                            className="h-3 w-3 text-[#ED1B2F] fill-current"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Extra content (RSVP, reviews, etc.) */}
          {children}
        </div>

        {/* Right Column — Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            {/* Action Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-white/5 border border-[#ED1B2F]/10 shadow-sm space-y-6">
              {/* Save / RSVP Buttons */}
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleSave}
                  className={cn(
                    "w-full py-6 font-bold rounded-xl flex items-center justify-center gap-2 text-base transition-all",
                    saved
                      ? "bg-[#ED1B2F] text-white hover:bg-[#ED1B2F]/90"
                      : "bg-[#ED1B2F] text-white hover:bg-[#ED1B2F]/90"
                  )}
                >
                  <Heart
                    className={cn("h-5 w-5", saved && "fill-current")}
                  />
                  {saved ? "Saved" : "Save Event"}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleNativeShare}
                  className="w-full py-5 border-2 border-[#ED1B2F] text-[#ED1B2F] font-bold rounded-xl hover:bg-[#ED1B2F]/5 transition-colors flex items-center justify-center gap-2"
                >
                  <Share2 className="h-5 w-5" />
                  Share Event
                </Button>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    asChild
                    className="py-5 border border-[#ED1B2F]/20 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-[#ED1B2F]/5 flex items-center justify-center gap-2 text-sm"
                  >
                    <a href={mapsUrl} target="_blank" rel="noreferrer">
                      <MapPin className="h-4 w-4" />
                      Directions
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="py-5 border border-[#ED1B2F]/20 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-[#ED1B2F]/5 flex items-center justify-center gap-2 text-sm"
                    onClick={() => {
                      // Calendar add could be wired up
                    }}
                  >
                    <Calendar className="h-4 w-4" />
                    Calendar
                  </Button>
                </div>
              </div>

              {/* Category & Tags */}
              <div className="pt-4 border-t border-[#ED1B2F]/10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Category
                  </span>
                  <div className="flex gap-1.5">
                    {event.tags.map((tag) => {
                      const cat = EVENT_CATEGORIES[tag];
                      return (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="px-3 py-1 bg-[#ED1B2F]/10 text-[#ED1B2F] rounded-full text-xs font-bold"
                        >
                          {cat?.label || tag}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Viral Sharing Section */}
              <div className="pt-4 border-t border-[#ED1B2F]/10 space-y-3">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Share with friends
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    className={cn(
                      "h-10 w-10 rounded-full border-[#ED1B2F]/20 transition-all",
                      copied
                        ? "bg-green-50 border-green-300 text-green-600 dark:bg-green-950 dark:border-green-700"
                        : "text-slate-600 dark:text-slate-300 hover:bg-[#ED1B2F]/5 hover:text-[#ED1B2F]"
                    )}
                    aria-label={copied ? "Link copied" : "Copy link"}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleShareTwitter}
                    className="h-10 w-10 rounded-full border-[#ED1B2F]/20 text-slate-600 dark:text-slate-300 hover:bg-[#ED1B2F]/5 hover:text-[#ED1B2F]"
                    aria-label="Share on Twitter"
                  >
                    <Twitter className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleShareFacebook}
                    className="h-10 w-10 rounded-full border-[#ED1B2F]/20 text-slate-600 dark:text-slate-300 hover:bg-[#ED1B2F]/5 hover:text-[#ED1B2F]"
                    aria-label="Share on Facebook"
                  >
                    <Facebook className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Similar Events */}
            {similarEvents.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Similar Events
                  </h3>
                </div>

                {/* Vertical list on sidebar (matches Stitch design) */}
                <div className="space-y-3">
                  {similarEvents.slice(0, 5).map((similarEvent) => {
                    const simTag = similarEvent.tags[0] as EventTag | undefined;
                    const simCat = simTag ? EVENT_CATEGORIES[simTag] : null;

                    return (
                      <button
                        key={similarEvent.id}
                        onClick={() => onEventClick?.(similarEvent.id)}
                        className="group/card cursor-pointer rounded-xl overflow-hidden bg-white dark:bg-white/5 border border-[#ED1B2F]/10 hover:shadow-md transition-all w-full text-left"
                      >
                        <div className="relative aspect-video w-full overflow-hidden">
                          {similarEvent.image_url ? (
                            <Image
                              src={similarEvent.image_url}
                              alt={similarEvent.title}
                              fill
                              className="object-cover transition-transform duration-500 group-hover/card:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#561c24]/30 to-[#ED1B2F]/20" />
                          )}
                        </div>
                        <div className="p-3">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[10px] font-bold uppercase text-[#ED1B2F]">
                              {simCat?.label || (simTag ?? "")}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {formatDate(similarEvent.event_date).replace(
                                /,\s*\d{4}$/,
                                ""
                              )}
                            </span>
                          </div>
                          <p className="font-bold text-sm line-clamp-1 text-slate-900 dark:text-slate-100">
                            {similarEvent.title}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

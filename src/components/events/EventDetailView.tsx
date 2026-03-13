// src/components/events/EventDetailView.tsx
"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { EventBadge } from "@/components/events/EventBadge";
import { formatDate, formatTime, cn } from "@/lib/utils";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { exportEventIcal } from "@/lib/exportUtils";
import type { Event, EventTag, ReviewAggregate } from "@/types";
import { ScrollRow } from "@/components/events/ScrollRow";
import { DiscoveryCard } from "@/components/events/DiscoveryCard";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Bookmark,
  Heart,
  Share2,
  Star,
  ExternalLink,
  Flame,
  ArrowRight,
} from "lucide-react";

interface EventDetailViewProps {
  event: Event;
  similarEvents?: Event[];
  isSaved?: boolean;
  onSave?: () => void;
  onShare?: (platform: string) => void;
  onEventClick?: (eventId: string) => void;
  reviews?: ReviewAggregate;
  children?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
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
  backHref = "/",
  backLabel = "Back to Events",
}: EventDetailViewProps) {
  const [saved, setSaved] = useState(isSaved);
  const [liked, setLiked] = useState(false);

  const eventUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/events/${event.id}`
      : `/events/${event.id}`;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;

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
        await navigator.clipboard.writeText(eventUrl);
        onShare?.("copy");
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.warn("Share failed:", err);
      }
    }
  }, [event.title, event.description, eventUrl, onShare]);

  const handleSave = useCallback(() => {
    setSaved((prev) => !prev);
    onSave?.();
  }, [onSave]);

  const handleLike = useCallback(() => {
    setLiked((prev) => !prev);
  }, []);

  const primaryTag = event.tags[0] as EventTag | undefined;
  const categoryInfo = primaryTag ? EVENT_CATEGORIES[primaryTag] : null;

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-white via-white to-primary/10 dark:from-black dark:via-background dark:to-primary/10">
      {/* ─── Full-Bleed Hero ─── */}
      <div className="relative w-full h-[55vh] min-h-[450px]">
        <div className="absolute inset-0">
          <Image
            src={event.image_url || "/placeholder-event.png"}
            alt={event.title}
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Gradient overlay: fades hero image into page background */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-white dark:from-black/40 dark:via-transparent dark:to-black" />

        {/* Top bar */}
        <div className="absolute top-0 w-full px-6 py-8 z-20">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={backHref}
                className="group flex items-center gap-2 bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-5 py-2.5 rounded-full transition-all duration-300"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                <span className="text-sm font-semibold tracking-wide">
                  {backLabel}
                </span>
              </Link>
              <button
                onClick={handleNativeShare}
                aria-label="Share"
                className="flex items-center justify-center w-10 h-10 bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-full transition-all duration-300 cursor-pointer"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Content (overlaps hero) ─── */}
      <main className="w-full max-w-7xl mx-auto px-6 pb-24 -mt-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* ─── Left Column ─── */}
          <div className="lg:col-span-8 flex flex-col gap-10">
            {/* Title block */}
            <div className="space-y-4">
              {primaryTag && categoryInfo && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/30 text-white border border-white/20 backdrop-blur-md dark:bg-white/10 dark:text-primary dark:border-primary/20 text-xs font-bold tracking-widest uppercase mb-2">
                  <Flame className="h-3.5 w-3.5" />
                  {categoryInfo.label} Event
                </div>
              )}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-foreground leading-[1.1] tracking-tight">
                {event.title}
              </h1>
              {event.description && (
                <p className="text-xl md:text-2xl text-muted-foreground font-medium leading-snug line-clamp-2">
                  {event.description.split("\n")[0]}
                </p>
              )}
            </div>

            {/* Hosted by */}
            {event.club && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 py-6 border-y border-border">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-full border border-border flex-shrink-0 overflow-hidden bg-primary/10 flex items-center justify-center">
                    {event.club.logo_url ? (
                      <Image
                        src={event.club.logo_url}
                        alt={event.club.name}
                        width={64}
                        height={64}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <span className="font-bold text-primary text-lg">
                        {event.club.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 4)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col justify-center">
                    <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase mb-1">
                      Hosted by
                    </p>
                    <p className="text-foreground text-xl font-bold">
                      {event.club.name}
                    </p>
                    {event.club.category && (
                      <p className="text-muted-foreground text-sm">
                        {event.club.category}
                      </p>
                    )}
                  </div>
                </div>
                <Link
                  href={`/clubs/${event.club_id}`}
                  className="px-5 py-2 rounded-full border border-border hover:bg-muted text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  View Profile
                </Link>
              </div>
            )}

            {/* About this event */}
            <div className="space-y-6 text-muted-foreground text-lg leading-relaxed">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                About this event
              </h2>
              {event.description ? (
                event.description
                  .split("\n")
                  .filter(Boolean)
                  .map((paragraph, i) => <p key={i}>{paragraph}</p>)
              ) : (
                <p className="text-muted-foreground">No description provided.</p>
              )}

              {event.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {event.tags.map((tag) => (
                    <EventBadge key={tag} tag={tag} variant="glowing" />
                  ))}
                </div>
              )}
            </div>

            {/* Reviews */}
            {reviews && reviews.total_reviews > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-foreground">Reviews</h3>
                  <div className="flex items-center gap-1 text-primary">
                    <Star className="h-5 w-5 fill-current" />
                    <span className="font-bold">
                      {reviews.average_rating.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      ({reviews.total_reviews} review
                      {reviews.total_reviews !== 1 ? "s" : ""})
                    </span>
                  </div>
                </div>
                {reviews.comments.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reviews.comments.slice(0, 4).map((review, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-black/[0.02] border border-black/10 dark:bg-white/[0.05] dark:border-white/10"
                      >
                        <p className="italic text-sm text-muted-foreground">
                          &ldquo;{review.comment}&rdquo;
                        </p>
                        <div className="flex items-center gap-1 mt-2">
                          {Array.from({ length: review.rating }).map((_, i) => (
                            <Star
                              key={i}
                              className="h-3 w-3 text-primary fill-current"
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {children}
          </div>

          {/* ─── Right Sidebar ─── */}
          <div className="lg:col-span-4 relative">
            <div className="sticky top-8 bg-black/[0.03] backdrop-blur-xl border border-black/10 rounded-2xl p-7 shadow-xl shadow-black/5 dark:bg-white/[0.05] dark:border-white/10 dark:shadow-2xl">
              {/* Date & Time */}
              <div className="space-y-6 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/15 dark:bg-primary/10 dark:border-primary/20 flex items-center justify-center text-primary shrink-0">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-foreground font-bold text-lg">
                      {formatDate(event.event_date)}
                    </span>
                    <span className="text-muted-foreground text-sm mt-0.5">
                      {formatTime(event.event_time)}
                    </span>
                    <button
                      onClick={() => exportEventIcal(event.id, event.title)}
                      className="text-primary text-sm font-medium mt-1 hover:underline text-left cursor-pointer"
                    >
                      Add to Calendar
                    </button>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/15 dark:bg-primary/10 dark:border-primary/20 flex items-center justify-center text-primary shrink-0">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-foreground font-bold text-lg">
                      {event.location}
                    </span>
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground text-sm mt-0.5 hover:text-primary transition-colors flex items-center gap-1"
                    >
                      View on Google Maps
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Map preview */}
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="block w-full h-36 rounded-xl mb-8 border border-black/10 dark:border-white/10 relative overflow-hidden group cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-200 to-neutral-100 dark:from-neutral-800 dark:to-neutral-900 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-primary drop-shadow-lg" />
                </div>
                <div className="absolute inset-0 bg-black/10 dark:bg-black/20 group-hover:bg-transparent transition-colors duration-300" />
                <div className="absolute bottom-2 right-2 bg-black/40 dark:bg-white/10 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-white dark:text-white/80 font-medium">
                  View larger map
                </div>
              </a>

              {/* Save / Like buttons */}
              <div className="pt-2">
                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={handleSave}
                    aria-label={saved ? "Unsave" : "Save"}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 backdrop-blur-md border rounded-xl py-2.5 transition-all duration-300 group cursor-pointer",
                      saved
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-black/[0.03] hover:bg-black/[0.06] border-black/10 text-foreground dark:bg-white/[0.05] dark:hover:bg-white/10 dark:border-white/10"
                    )}
                  >
                    <Bookmark
                      className={cn(
                        "h-5 w-5 transition-colors",
                        saved
                          ? "fill-current text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm font-semibold transition-colors",
                        saved
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    >
                      {saved ? "Saved" : "Save"}
                    </span>
                  </button>
                  <button
                    onClick={handleLike}
                    aria-label={liked ? "Unlike" : "Like"}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 backdrop-blur-md border rounded-xl py-2.5 transition-all duration-300 group cursor-pointer",
                      liked
                        ? "bg-primary/10 border-primary/30"
                        : "bg-black/[0.03] hover:bg-black/[0.06] border-black/10 hover:border-primary/30 dark:bg-white/[0.05] dark:hover:bg-white/10 dark:border-white/10"
                    )}
                  >
                    <Heart
                      className={cn(
                        "h-5 w-5 transition-colors",
                        liked
                          ? "fill-current text-primary"
                          : "text-muted-foreground group-hover:text-primary"
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm font-semibold transition-colors",
                        liked
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-primary"
                      )}
                    >
                      Like
                    </span>
                  </button>
                </div>

                {/* Registration */}
                <div className="flex items-end justify-between mb-5">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-sm font-medium mb-1">
                      Registration
                    </span>
                    <span className="text-3xl font-black text-foreground">Free</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-black/[0.05] text-muted-foreground text-xs font-bold uppercase tracking-wider dark:bg-white/10">
                    McGill ID Req.
                  </span>
                </div>

                {/* Register Now CTA */}
                <button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg py-4 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(237,29,49,0.25)] hover:shadow-[0_0_35px_rgba(237,29,49,0.4)] flex items-center justify-center gap-2 cursor-pointer">
                  Register Now
                  <ArrowRight className="h-5 w-5" />
                </button>
                <p className="text-center text-muted-foreground text-xs mt-4">
                  Limited spots available.
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* ─── Similar Events — full-width horizontal row ─── */}
      {similarEvents.length > 0 && (
        <section className="-mt-10 pb-24">
          <div className="px-6 md:px-10 lg:px-12 mb-5">
            <h3 className="text-2xl font-extrabold text-foreground tracking-tight">
              Similar Events
            </h3>
          </div>
          <ScrollRow className="px-6 md:px-10 lg:px-12">
            {similarEvents.map((similarEvent) => (
              <div
                key={similarEvent.id}
                className="flex-shrink-0 w-[calc(85vw-2rem)] sm:w-[300px] md:w-[340px] lg:w-[320px]"
              >
                <DiscoveryCard
                  event={similarEvent}
                  onClick={() => onEventClick?.(similarEvent.id)}
                />
              </div>
            ))}
          </ScrollRow>
        </section>
      )}
    </div>
  );
}

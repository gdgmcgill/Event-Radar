// src/components/events/EventDetailsModal.tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EventBadge } from "@/components/events/EventBadge";
import { formatDate, formatTime, cn } from "@/lib/utils";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { exportEventIcal } from "@/lib/exportUtils";
import type { Event, EventTag, InteractionSource } from "@/types";
import {
  Calendar,
  MapPin,
  Bookmark,
  Heart,
  Share2,
  ExternalLink,
  Flame,
  ArrowRight,
  Check,
  Maximize2,
  X,
} from "lucide-react";
import { useTrackEventModal, useTracking } from "@/hooks/useTracking";

type ModalEvent = Omit<Event, "club"> & {
  club?: { name: string; logo_url?: string | null; category?: string; [key: string]: unknown };
};

type EventDetailsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: ModalEvent | null;
  trackingSource?: InteractionSource;
};

export function EventDetailsModal({ open, onOpenChange, event, trackingSource }: EventDetailsModalProps) {
  const router = useRouter();
  useTrackEventModal(event?.id || null, open, trackingSource);
  const { trackCalendarAdd, trackShare } = useTracking({ source: trackingSource });
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);

  const handleShare = useCallback(async () => {
    if (!event) return;
    const url = `${window.location.origin}/events/${event.id}`;
    trackShare(event.id);
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, text: event.description, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.warn("Share failed:", err);
      }
    }
  }, [event, trackShare]);

  const handleSave = useCallback(() => setSaved((prev) => !prev), []);
  const handleLike = useCallback(() => setLiked((prev) => !prev), []);

  if (!event) return null;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;
  const primaryTag = event.tags[0] as EventTag | undefined;
  const categoryInfo = primaryTag ? EVENT_CATEGORIES[primaryTag] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 gap-0 border-0 bg-gradient-to-b from-white via-white to-primary/5 dark:from-neutral-950 dark:via-background dark:to-primary/5 shadow-2xl rounded-2xl">
        {/* ─── Hero Image ─── */}
        <div className="relative w-full h-[200px] sm:h-[250px]">
          <div className="absolute inset-0">
            <Image
              src={event.image_url || "/placeholder-event.png"}
              alt={event.title}
              fill
              className="object-cover rounded-t-2xl"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-white dark:from-black/50 dark:via-transparent dark:to-neutral-950 rounded-t-2xl" />

          {/* Top controls */}
          <div className="absolute top-0 w-full px-4 py-4 z-20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                aria-label="Share"
                className="flex items-center justify-center w-9 h-9 bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-full transition-all duration-300 cursor-pointer"
              >
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Share2 className="h-4 w-4" />}
              </button>
              <button
                onClick={() => {
                  onOpenChange(false);
                  router.push(`/events/${event.id}`);
                }}
                aria-label="View full page"
                className="flex items-center justify-center w-9 h-9 bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-full transition-all duration-300 cursor-pointer"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="flex items-center justify-center w-9 h-9 bg-black/40 hover:bg-black/60 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-full transition-all duration-300 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ─── Content ─── */}
        <div className="px-6 sm:px-8 pb-8 -mt-10 relative z-10">
          {/* Title block */}
          <div className="space-y-3 mb-6">
            {primaryTag && categoryInfo && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/30 text-white border border-white/20 backdrop-blur-md dark:bg-white/10 dark:text-primary dark:border-primary/20 text-xs font-bold tracking-widest uppercase">
                <Flame className="h-3.5 w-3.5" />
                {categoryInfo.label} Event
              </div>
            )}
            <DialogTitle className="text-3xl sm:text-4xl font-black text-foreground leading-[1.1] tracking-tight">
              {event.title}
            </DialogTitle>
          </div>

          {/* Hosted by */}
          {event.club && (
            <div className="flex items-center justify-between gap-4 py-5 border-y border-border mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full border border-border flex-shrink-0 overflow-hidden bg-primary/10 flex items-center justify-center">
                  {event.club.logo_url ? (
                    <Image
                      src={event.club.logo_url}
                      alt={event.club.name}
                      width={48}
                      height={48}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <span className="font-bold text-primary text-sm">
                      {event.club.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 4)
                        .toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex flex-col">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Hosted by
                  </p>
                  <p className="text-foreground text-base font-bold">
                    {event.club.name}
                  </p>
                  {event.club.category && (
                    <p className="text-muted-foreground text-xs">{event.club.category}</p>
                  )}
                </div>
              </div>
              {event.club_id && (
                <Link
                  href={`/clubs/${event.club_id}`}
                  onClick={() => onOpenChange(false)}
                  className="px-4 py-1.5 rounded-full border border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  View Profile
                </Link>
              )}
            </div>
          )}

          {/* Info cards row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* Date & Time */}
            <div className="flex items-start gap-4 p-4 rounded-xl bg-black/[0.03] border border-black/10 dark:bg-white/[0.05] dark:border-white/10">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/15 dark:bg-primary/10 dark:border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Calendar className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-foreground font-bold text-sm">
                  {formatDate(event.event_date)}
                </span>
                <span className="text-muted-foreground text-xs mt-0.5">
                  {formatTime(event.event_time)}
                </span>
                <button
                  onClick={() => {
                    exportEventIcal(event.id, event.title);
                    trackCalendarAdd(event.id);
                  }}
                  className="text-primary text-xs font-medium mt-1 hover:underline text-left cursor-pointer"
                >
                  Add to Calendar
                </button>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-start gap-4 p-4 rounded-xl bg-black/[0.03] border border-black/10 dark:bg-white/[0.05] dark:border-white/10">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/15 dark:bg-primary/10 dark:border-primary/20 flex items-center justify-center text-primary shrink-0">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-foreground font-bold text-sm">
                  {event.location}
                </span>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground text-xs mt-0.5 hover:text-primary transition-colors flex items-center gap-1"
                >
                  View on Google Maps
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          {/* About this event */}
          <div className="space-y-3 mb-6">
            <h2 className="text-lg font-bold text-foreground">About this event</h2>
            <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
              {event.description ? (
                event.description
                  .split("\n")
                  .filter(Boolean)
                  .map((paragraph, i) => <p key={i}>{paragraph}</p>)
              ) : (
                <p>No description provided.</p>
              )}
            </div>
            {event.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {event.tags.map((tag) => (
                  <EventBadge key={tag} tag={tag} variant="glowing" />
                ))}
              </div>
            )}
          </div>

          {/* Map preview */}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="block w-full h-28 rounded-xl mb-6 border border-black/10 dark:border-white/10 relative overflow-hidden group cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-200 to-neutral-100 dark:from-neutral-800 dark:to-neutral-900 flex items-center justify-center">
              <MapPin className="h-7 w-7 text-primary drop-shadow-lg" />
            </div>
            <div className="absolute inset-0 bg-black/10 dark:bg-black/20 group-hover:bg-transparent transition-colors duration-300" />
            <div className="absolute bottom-2 right-2 bg-black/40 dark:bg-white/10 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-white dark:text-white/80 font-medium">
              View larger map
            </div>
          </a>

          {/* Save / Like buttons */}
          <div className="flex items-center gap-3 mb-5">
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
                  saved ? "fill-current text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span
                className={cn(
                  "text-sm font-semibold transition-colors",
                  saved ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
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
                  liked ? "fill-current text-primary" : "text-muted-foreground group-hover:text-primary"
                )}
              />
              <span
                className={cn(
                  "text-sm font-semibold transition-colors",
                  liked ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                )}
              >
                Like
              </span>
            </button>
          </div>

          {/* Registration + CTA */}
          <div className="pt-5 border-t border-border">
            <div className="flex items-end justify-between mb-4">
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs font-medium mb-1">Registration</span>
                <span className="text-2xl font-black text-foreground">Free</span>
              </div>
              <span className="px-3 py-1 rounded-full bg-black/[0.05] text-muted-foreground text-xs font-bold uppercase tracking-wider dark:bg-white/10">
                McGill ID Req.
              </span>
            </div>
            <button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base py-3.5 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(237,29,49,0.25)] hover:shadow-[0_0_35px_rgba(237,29,49,0.4)] flex items-center justify-center gap-2 cursor-pointer">
              Register Now
              <ArrowRight className="h-5 w-5" />
            </button>
            <p className="text-center text-muted-foreground text-xs mt-3">
              Limited spots available.
            </p>
          </div>

          {/* Source link */}
          {event.source_url && (
            <div className="mt-4 pt-4 border-t border-border">
              <a
                href={event.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                View original post
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

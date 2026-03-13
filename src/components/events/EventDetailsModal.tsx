// src/components/events/EventDetailsModal.tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EventBadge } from "@/components/events/EventBadge";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/utils";
import type { Event, InteractionSource } from "@/types";
import { MapPin, Calendar, Clock, ExternalLink, Share2, Check, Loader2 } from "lucide-react";
import { useTrackEventModal, useTracking } from "@/hooks/useTracking";
import { exportEventIcal } from "@/lib/exportUtils";

type ModalEvent = Omit<Event, "club"> & {
  club?: { name: string; [key: string]: unknown };
};

type EventDetailsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: ModalEvent | null;
  /** Source context for tracking */
  trackingSource?: InteractionSource;
};

export function EventDetailsModal({ open, onOpenChange, event, trackingSource }: EventDetailsModalProps) {
  // Track modal view when opened
  useTrackEventModal(event?.id || null, open, trackingSource);
  const { trackCalendarAdd, trackShare } = useTracking({ source: trackingSource });
  const [copied, setCopied] = useState(false);
  const [isExportingIcal, setIsExportingIcal] = useState(false);

  if (!event) return null;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    event.location,
  )}`;

  const handleShare = async () => {
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
  };

  const handleAddToCalendar = async () => {
    try {
      setIsExportingIcal(true);
      await exportEventIcal(event.id, event.title);
      trackCalendarAdd(event.id);
    } catch (err) {
      // Error already logged in exportUtils
    } finally {
      setIsExportingIcal(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-card border-border shadow-2xl rounded-2xl">
        {/* Header / Image Placeholder if available */}
        <div className="relative h-40 w-full bg-secondary/30 flex items-center justify-center border-b border-border/50">
           {/* If we had an image, it would go here. For now, a pattern or placeholder. */}
           <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/10" />
           <div className="z-10 text-primary/20">
             {/* Optional: Icon or Logo */}
           </div>
        </div>

        <div className="p-6 space-y-6">
          <DialogHeader className="space-y-4 text-left">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {event.tags.map((tag) => (
                  <EventBadge key={tag} tag={tag} variant="glowing" />
                ))}
              </div>
              <DialogTitle className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
                {event.title}
              </DialogTitle>
            </div>
            
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span>{formatDate(event.event_date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span>{formatTime(event.event_time)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{event.location}</span>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">About this event</h4>
            <DialogDescription className="text-base text-muted-foreground leading-relaxed">
              {event.description || "No description provided."}
            </DialogDescription>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/50">
            <Button asChild className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2"
              >
                <MapPin className="h-4 w-4" />
                Open in Maps
              </a>
            </Button>
            
            <Button
              variant="outline"
              className="w-full sm:w-auto border-primary/20 text-primary hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleAddToCalendar}
              disabled={isExportingIcal}
            >
              {isExportingIcal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
              {isExportingIcal ? "Adding..." : "Add to Calendar"}
            </Button>

            <Button
              variant="outline"
              className="w-full sm:w-auto border-primary/20 text-primary hover:bg-primary/5"
              onClick={handleShare}
            >
              {copied ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Share2 className="mr-2 h-4 w-4" />}
              {copied ? "Copied!" : "Share"}
            </Button>

            {event.source_url && (
              <Button asChild variant="outline" className="w-full sm:w-auto border-primary/20 text-primary hover:bg-primary/5">
                <a
                  href={event.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  View on Instagram
                </a>
              </Button>
            )}
          </div>

          {event.club && (
            <div className="pt-4 mt-2 text-xs text-muted-foreground border-t border-border/50 flex justify-between items-center">
              <span>Hosted by <span className="font-semibold text-foreground">{event.club.name}</span></span>
              {/* Could add link to club profile here */}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

/**
 * Event detail client component
 * Fetches event by ID from the API and displays full details with save functionality
 */

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { EVENT_CATEGORIES } from "@/lib/constants";
import type { Event, EventPopularityScore } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";
import { Calendar, Clock, MapPin, Heart, ArrowLeft, Loader2, Eye, MousePointerClick, Bookmark, TrendingUp, Flame, ExternalLink } from "lucide-react";
import { RsvpButton } from "@/components/events/RsvpButton";

export default function EventDetailClient() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savingInProgress, setSavingInProgress] = useState(false);
  const [popularity, setPopularity] = useState<EventPopularityScore | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchEvent = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/events/${id}`);
        if (res.status === 404) {
          setEvent(null);
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch event");
        const data = await res.json();
        setEvent(data.event);
      } catch {
        setError("Failed to load event. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  // Check if the event is saved by the current user
  useEffect(() => {
    if (!user || !id) return;

    const checkSaved = async () => {
      try {
        const res = await fetch("/api/users/saved-events");
        if (!res.ok) return;
        const data = await res.json();
        const ids: string[] = data.savedEventIds || [];
        setSaved(ids.includes(id));
      } catch {
        // Silently fail
      }
    };

    checkSaved();
  }, [user, id]);

  // Fetch popularity data for this event
  useEffect(() => {
    if (!id) return;

    const fetchPopularity = async () => {
      try {
        const res = await fetch(`/api/events/popular?limit=50`);
        if (!res.ok) return;
        const data = await res.json();
        const match = data.events?.find((e: any) => e.id === id);
        if (match?.popularity) {
          setPopularity(match.popularity);
        }
      } catch {
        // Silently fail — popularity is non-critical
      }
    };

    fetchPopularity();
  }, [id]);

  const handleSave = useCallback(async () => {
    if (!user || !id || savingInProgress) return;

    setSavingInProgress(true);
    try {
      const res = await fetch(`/api/events/${id}/save`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to toggle save");
      const data = await res.json();
      setSaved(data.saved);
    } catch {
      // Silently fail
    } finally {
      setSavingInProgress(false);
    }
  }, [user, id, savingInProgress]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Events
          </Button>
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Events
          </Button>
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
          <h2 className="text-2xl font-bold">Event not found</h2>
          <p className="text-muted-foreground">
            This event may have been removed or doesn&apos;t exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/">
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Events
        </Button>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Event Image */}
          <div className="relative h-96 w-full overflow-hidden rounded-lg bg-muted">
            {event.image_url ? (
              <Image
                src={event.image_url}
                alt={event.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No Image Available
              </div>
            )}
          </div>

          {/* Event Details */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-3xl">{event.title}</CardTitle>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSave}
                  disabled={!user || savingInProgress}
                  title={user ? (saved ? "Unsave event" : "Save event") : "Sign in to save events"}
                >
                  <Heart
                    className={`h-5 w-5 transition-colors ${saved ? "fill-red-500 text-red-500" : ""}`}
                  />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg">{event.description}</p>

              <div className="space-y-3">
                <div className="flex items-center text-muted-foreground">
                  <Calendar className="mr-3 h-5 w-5" />
                  {formatDateTime(event.event_date, event.event_time)}
                </div>
                <div className="flex items-center text-muted-foreground">
                  <MapPin className="mr-3 h-5 w-5" />
                  {event.location}
                </div>
                {event.club && (
                  <div className="text-muted-foreground">
                    Organized by{" "}
                    <Link
                      href={`/clubs/${event.club.id}`}
                      className="text-primary hover:underline"
                    >
                      {event.club.name}
                    </Link>
                  </div>
                )}
                {event.source_url && (
                  <a
                    href={event.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View on Instagram
                  </a>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 pt-4">
                {event.tags.map((tag) => {
                  const category = EVENT_CATEGORIES[tag];
                  if (!category) return null;
                  return (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className={category.color}
                    >
                      {category.label}
                    </Badge>
                  );
                })}
              </div>

              {/* RSVP */}
              <div className="pt-4 border-t">
                <RsvpButton eventId={event.id} userId={user?.id ?? null} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Popularity Stats */}
          {popularity && (popularity.popularity_score > 0 || popularity.trending_score > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Event Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {popularity.trending_score >= 5 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 text-sm font-medium">
                    <Flame className="h-4 w-4" />
                    Trending Now
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <span>{popularity.view_count} views</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MousePointerClick className="h-4 w-4" />
                    <span>{popularity.click_count} clicks</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Bookmark className="h-4 w-4" />
                    <span>{popularity.save_count} saves</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{popularity.calendar_add_count} cal adds</span>
                  </div>
                </div>
                <div className="pt-2 border-t text-xs text-muted-foreground/70">
                  {popularity.unique_viewers} unique viewers
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

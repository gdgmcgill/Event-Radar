"use client";

/**
 * Event detail client component
 * Fetches event by ID from the API and displays full details with save functionality
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EventBadge } from "@/components/events/EventBadge";
import { SignInButton } from "@/components/auth/SignInButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";
import { EVENT_CATEGORIES } from "@/lib/constants";
import type { Event, EventPopularityScore } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";
import { Calendar, Clock, MapPin, Heart, Loader2, Eye, MousePointerClick, Bookmark, TrendingUp, Flame, ExternalLink, Share2, UserPlus } from "lucide-react";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { RsvpButton } from "@/components/events/RsvpButton";
import { RelatedEventCard } from "@/components/events/RelatedEventCard";
import { ReviewPrompt } from "@/components/events/ReviewPrompt";
import { EventReviewsSection } from "@/components/events/EventReviewsSection";
import { StarRating } from "@/components/events/StarRating";
import { useEventReviews } from "@/hooks/useAnalytics";
import { exportEventIcal } from "@/lib/exportUtils";
import { FriendsGoing } from "@/components/events/FriendsGoing";
import { InviteFriendsModal } from "@/components/events/InviteFriendsModal";

export default function EventDetailClient() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const user = useAuthStore((s) => s.user);

  function getBreadcrumbItems(title: string) {
    if (from === "my-events") {
      return [{ label: "My Events", href: "/my-events" }, { label: title }];
    }
    return [{ label: "Home", href: "/" }, { label: title }];
  }

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savingInProgress, setSavingInProgress] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [popularity, setPopularity] = useState<EventPopularityScore | null>(null);
  const [relatedEvents, setRelatedEvents] = useState<Event[]>([]);
  const [isExportingIcal, setIsExportingIcal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const { data: reviewData, mutate: mutateReviews } = useEventReviews(id ?? "");

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

  // Scroll to top when navigating to event detail
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

  // Fetch related events once the current event is loaded
  useEffect(() => {
    if (!event?.tags?.length) return;

    const fetchRelated = async () => {
      const tagsParam = event.tags.join(",");
      const now = new Date().toISOString();
      try {
        const res = await fetch(`/api/events?tags=${tagsParam}&limit=6&dateFrom=${now}`);
        if (!res.ok) return;
        const data = await res.json();
        const filtered = (data.events as Event[])
          .filter((e) => e.id !== event.id)
          .slice(0, 5);

        if (filtered.length > 0) {
          setRelatedEvents(filtered);
        } else {
          // Fallback: upcoming events with no tag filter
          const fallbackRes = await fetch(`/api/events?limit=6&dateFrom=${now}`);
          if (!fallbackRes.ok) return;
          const fallbackData = await fallbackRes.json();
          setRelatedEvents(
            (fallbackData.events as Event[])
              .filter((e) => e.id !== event.id)
              .slice(0, 5)
          );
        }
      } catch {
        // Silently fail — related events are non-critical
      }
    };

    fetchRelated();
  }, [event]);

  const handleSave = useCallback(async () => {
    if (!user) {
      setShowSignInPrompt(true);
      return;
    }
    if (!id || savingInProgress) return;

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

  const handleAddToCalendar = useCallback(async () => {
    if (!event) return;
    try {
      setIsExportingIcal(true);
      await exportEventIcal(event.id, event.title);
    } catch {
      // Error already logged in exportUtils
    } finally {
      setIsExportingIcal(false);
    }
  }, [event]);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback for older browsers
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <AppBreadcrumb items={getBreadcrumbItems("Error")} />
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
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <AppBreadcrumb items={getBreadcrumbItems("Not Found")} />
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
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <AppBreadcrumb items={getBreadcrumbItems(event.title)} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Event Image */}
          <div className="relative h-52 sm:h-72 md:h-96 w-full overflow-hidden rounded-lg bg-muted">
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
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-xl sm:text-2xl md:text-3xl">{event.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleAddToCalendar}
                    disabled={isExportingIcal}
                    aria-label={isExportingIcal ? "Adding to calendar…" : "Add to calendar"}
                    className="shrink-0"
                  >
                    {isExportingIcal ? <Loader2 className="h-5 w-5 animate-spin" /> : <Calendar className="h-5 w-5" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSave}
                    disabled={savingInProgress}
                    aria-label={savingInProgress ? "Saving…" : saved ? "Unsave event" : "Save event"}
                    className="shrink-0"
                  >
                    <Heart
                      className={`h-5 w-5 transition-colors ${saved ? "fill-red-500 text-red-500" : ""}`}
                    />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-base sm:text-lg">{event.description}</p>

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
                {event.tags.map((tag) => (
                  <EventBadge key={tag} tag={tag} variant="glowing" />
                ))}
              </div>

              {/* RSVP and Calendar Actions */}
              <div className="pt-4 border-t space-y-3">
                <RsvpButton eventId={event.id} userId={user?.id ?? null} />

                <Button
                  variant="outline"
                  className="w-full border-primary/20 text-primary hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleAddToCalendar}
                  disabled={isExportingIcal}
                >
                  {isExportingIcal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
                  {isExportingIcal ? "Adding..." : "Add to Calendar"}
                </Button>

                <div className="flex gap-2">
                  {user && (
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => setShowInviteModal(true)}
                    >
                      <UserPlus className="h-4 w-4" />
                      Invite Friends
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={handleShare}
                  >
                    <Share2 className="h-4 w-4" />
                    {linkCopied ? "Link Copied!" : "Share"}
                  </Button>
                </div>
              </div>

              {/* Friends Going */}
              {user && id && <FriendsGoing eventId={id} />}
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

          {/* Related Events */}
          {relatedEvents.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Related Events</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {relatedEvents.map((e) => (
                  <RelatedEventCard key={e.id} event={e} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      {event && (
        <div className="mt-8 space-y-4">
          {/* Show ReviewPrompt if user can review */}
          {user && reviewData?.can_review && !reviewData.user_review && (
            <ReviewPrompt
              eventId={event.id}
              onReviewSubmitted={() => mutateReviews()}
            />
          )}

          {/* Show user's existing review */}
          {user && reviewData?.user_review && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Your rating:</span>
              <StarRating value={reviewData.user_review.rating} readonly size="sm" />
            </div>
          )}

          {/* Show aggregate reviews */}
          {reviewData && reviewData.aggregate.total_reviews > 0 && (
            <EventReviewsSection
              eventId={event.id}
              isOrganizer={false}
            />
          )}
        </div>
      )}

      {user && id && (
        <InviteFriendsModal
          open={showInviteModal}
          onOpenChange={setShowInviteModal}
          eventId={id}
        />
      )}

      <Dialog open={showSignInPrompt} onOpenChange={setShowSignInPrompt}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign in to save events</DialogTitle>
            <DialogDescription>
              Create an account or sign in with your McGill email to save events and get personalised recommendations.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-2">
            <SignInButton className="w-full sm:w-auto" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

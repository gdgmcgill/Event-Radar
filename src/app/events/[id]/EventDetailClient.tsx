"use client";

/**
 * Event detail client component
 * Fetches event by ID from the API and renders the enhanced EventDetailView
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignInButton } from "@/components/auth/SignInButton";
import { EventDetailView } from "@/components/events/EventDetailView";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { RsvpButton } from "@/components/events/RsvpButton";
import { ReviewPrompt } from "@/components/events/ReviewPrompt";
import { EventReviewsSection } from "@/components/events/EventReviewsSection";
import { StarRating } from "@/components/events/StarRating";
import { FriendsGoing } from "@/components/events/FriendsGoing";
import { InviteFriendsModal } from "@/components/events/InviteFriendsModal";
import { useAuthStore } from "@/store/useAuthStore";
import { useEventReviews } from "@/hooks/useAnalytics";
import { exportEventIcal } from "@/lib/exportUtils";
import type { Event, ReviewAggregate } from "@/types";
import { Loader2, UserPlus } from "lucide-react";

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
  const [relatedEvents, setRelatedEvents] = useState<Event[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const { data: reviewData, mutate: mutateReviews } = useEventReviews(id ?? "");

  // Build ReviewAggregate for EventDetailView
  const reviewAggregate: ReviewAggregate | undefined =
    reviewData?.aggregate && reviewData.aggregate.total_reviews > 0
      ? reviewData.aggregate
      : undefined;

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

  // Check saved state
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

  // Scroll to top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Fetch related events
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
        // Silently fail
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

  const handleShare = useCallback((platform: string) => {
    // Tracking could go here
  }, []);

  const handleEventClick = useCallback((eventId: string) => {
    window.location.href = `/events/${eventId}`;
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

      {/* New Enhanced Event Detail View */}
      <EventDetailView
        event={event}
        similarEvents={relatedEvents}
        isSaved={saved}
        onSave={handleSave}
        onShare={handleShare}
        onEventClick={handleEventClick}
        reviews={reviewAggregate}
      >
        {/* RSVP, Friends Going, Invite — rendered inside left column */}
        <div className="space-y-4">
          <RsvpButton eventId={event.id} userId={user?.id ?? null} />

          {user && id && <FriendsGoing eventId={id} />}

          {user && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setShowInviteModal(true)}
            >
              <UserPlus className="h-4 w-4" />
              Invite Friends
            </Button>
          )}

          {/* Reviews */}
          {user && reviewData?.can_review && !reviewData.user_review && (
            <ReviewPrompt
              eventId={event.id}
              onReviewSubmitted={() => mutateReviews()}
            />
          )}
          {user && reviewData?.user_review && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Your rating:</span>
              <StarRating value={reviewData.user_review.rating} readonly size="sm" />
            </div>
          )}
          {reviewData && reviewData.aggregate.total_reviews > 0 && (
            <EventReviewsSection eventId={event.id} isOrganizer={false} />
          )}
        </div>
      </EventDetailView>

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

"use client";

/**
 * Event detail client component
 * Fetches event by ID from the API and renders the enhanced EventDetailView
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
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
import { RsvpButton } from "@/components/events/RsvpButton";
import { ReviewPrompt } from "@/components/events/ReviewPrompt";
import { EventReviewsSection } from "@/components/events/EventReviewsSection";
import { StarRating } from "@/components/events/StarRating";
import { FriendsGoing } from "@/components/events/FriendsGoing";
import { InviteFriendsModal } from "@/components/events/InviteFriendsModal";
import { useAuthStore } from "@/store/useAuthStore";
import { useEventReviews } from "@/hooks/useAnalytics";
import type { Event, ReviewAggregate, RejectionCategory } from "@/types";
import { REJECTION_CATEGORIES } from "@/types";
import { AppealForm } from "@/components/AppealForm";
import { ReviewThread } from "@/components/moderation/ReviewThread";
import { Loader2, UserPlus, AlertTriangle } from "lucide-react";

export default function EventDetailClient() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const user = useAuthStore((s) => s.user);

  const backHref = from === "my-events" ? "/my-events" : "/";
  const backLabel =
    from === "my-events" ? "Back to My Events" : "Back to Events";

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savingInProgress, setSavingInProgress] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [relatedEvents, setRelatedEvents] = useState<Event[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [latestRejection, setLatestRejection] = useState<{
    category: string;
    message: string;
    created_at: string;
  } | null>(null);
  const { data: reviewData, mutate: mutateReviews } = useEventReviews(
    id ?? ""
  );

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
        if (data.event.status === "rejected" && user?.id === data.event.created_by) {
          try {
            const reviewRes = await fetch(`/api/moderation/reviews/event/${id}`);
            if (reviewRes.ok) {
              const reviewData = await reviewRes.json();
              const rejections = (reviewData.reviews ?? []).filter(
                (r: { action: string }) => r.action === "rejection"
              );
              if (rejections.length > 0) {
                setLatestRejection(rejections[rejections.length - 1]);
              }
            }
          } catch {
            // Non-critical, don't block the page
          }
        }
      } catch {
        setError("Failed to load event. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id, user]);

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
        const res = await fetch(
          `/api/events?tags=${tagsParam}&limit=6&dateFrom=${now}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const filtered = (data.events as Event[])
          .filter((e) => e.id !== event.id)
          .slice(0, 5);
        if (filtered.length > 0) {
          setRelatedEvents(filtered);
        } else {
          const fallbackRes = await fetch(
            `/api/events?limit=6&dateFrom=${now}`
          );
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 px-6">
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-2 px-6">
        <h2 className="text-2xl font-bold">Event not found</h2>
        <p className="text-muted-foreground">
          This event may have been removed or doesn&apos;t exist.
        </p>
      </div>
    );
  }

  return (
    <>
      {event && event.status === "rejected" && user?.id === event.created_by && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 p-4 space-y-3 mb-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h3 className="font-semibold text-red-700 dark:text-red-400">
              This event was not approved
            </h3>
          </div>
          {latestRejection && (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              <span className="inline-flex items-center rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400 mr-2">
                {REJECTION_CATEGORIES[latestRejection.category as RejectionCategory]}
              </span>
              {latestRejection.message}
            </div>
          )}
          <ReviewThread targetType="event" targetId={event.id} currentUserId={user?.id} />
          <AppealForm itemType="event" itemId={event.id} onSuccess={() => window.location.reload()} />
        </div>
      )}
      <EventDetailView
        event={event}
        similarEvents={relatedEvents}
        isSaved={saved}
        onSave={handleSave}
        onShare={handleShare}
        onEventClick={handleEventClick}
        reviews={reviewAggregate}
        backHref={backHref}
        backLabel={backLabel}
      >
        {/* RSVP, Friends Going, Invite — rendered inside left column */}
        <div className="space-y-4">
          <RsvpButton eventId={event.id} userId={user?.id ?? null} />

          {user && id && <FriendsGoing eventId={id} />}

          {user && (
            <Button
              variant="outline"
              className="w-full gap-2 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
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
              <StarRating
                value={reviewData.user_review.rating}
                readonly
                size="sm"
              />
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
              Create an account or sign in with your McGill email to save events
              and get personalised recommendations.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-2">
            <SignInButton className="w-full sm:w-auto" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

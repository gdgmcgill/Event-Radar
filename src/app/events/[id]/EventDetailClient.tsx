"use client";

/**
 * Event detail client component
 * Fetches event by ID from the API and displays full details with save functionality
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/auth/SignInButton";
import { Badge } from "@/components/ui/badge";
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
import type { Event } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";
import { Calendar, MapPin, Heart, ArrowLeft, Loader2 } from "lucide-react";
import { RsvpButton } from "@/components/events/RsvpButton";

export default function EventDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savingInProgress, setSavingInProgress] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);

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
        <Button variant="ghost" className="mb-4 sm:mb-6" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Events
        </Button>
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
        <Button variant="ghost" className="mb-4 sm:mb-6" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Events
        </Button>
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
      <Button variant="ghost" className="mb-4 sm:mb-6" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Events
      </Button>

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
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSave}
                  disabled={savingInProgress}
                  title={saved ? "Unsave event" : "Save event"}
                  className="shrink-0"
                >
                  <Heart
                    className={`h-5 w-5 transition-colors ${saved ? "fill-red-500 text-red-500" : ""}`}
                  />
                </Button>
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
          {/* TODO: Add related events */}
          {/* TODO: Add share functionality */}
        </div>
      </div>

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

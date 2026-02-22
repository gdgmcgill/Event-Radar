// src/components/events/RsvpButton.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserCheck, Star, Loader2, X } from "lucide-react";
import type { RsvpStatus } from "@/types";

interface RsvpButtonProps {
  eventId: string;
  userId?: string | null;
}

interface RsvpCounts {
  going: number;
  interested: number;
  total: number;
}

interface UserRsvp {
  id: string;
  status: RsvpStatus;
}

export function RsvpButton({ eventId, userId }: RsvpButtonProps) {
  const [counts, setCounts] = useState<RsvpCounts>({ going: 0, interested: 0, total: 0 });
  const [userRsvp, setUserRsvp] = useState<UserRsvp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch current RSVP state
  useEffect(() => {
    async function fetchRsvp() {
      try {
        const res = await fetch(`/api/events/${eventId}/rsvp`);
        if (!res.ok) return;
        const data = await res.json();
        setCounts(data.counts);
        setUserRsvp(data.user_rsvp);
      } catch (error) {
        console.error("Error fetching RSVP:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchRsvp();
  }, [eventId]);

  const handleRsvp = async (status: "going" | "interested") => {
    if (!userId) {
      // Could redirect to login or show a toast
      alert("Please sign in to RSVP");
      return;
    }

    setIsSubmitting(true);
    try {
      // If clicking the same status, cancel the RSVP
      if (userRsvp?.status === status) {
        const res = await fetch(`/api/events/${eventId}/rsvp`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        });
        if (!res.ok) throw new Error("Failed to cancel RSVP");

        setUserRsvp(null);
        setCounts((prev) => ({
          ...prev,
          [status]: Math.max(0, prev[status] - 1),
          total: Math.max(0, prev.total - 1),
        }));
        return;
      }

      // Create or update RSVP
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, status }),
      });
      if (!res.ok) throw new Error("Failed to RSVP");

      const data = await res.json();
      setUserRsvp(data.rsvp);

      // Update counts
      setCounts((prev) => {
        const newCounts = { ...prev };
        // If switching from another status, decrement old
        if (userRsvp?.status && userRsvp.status !== status) {
          const oldStatus = userRsvp.status as "going" | "interested";
          newCounts[oldStatus] = Math.max(0, newCounts[oldStatus] - 1);
          newCounts[status] = newCounts[status] + 1;
        } else {
          // New RSVP
          newCounts[status] = newCounts[status] + 1;
          newCounts.total = newCounts.total + 1;
        }
        return newCounts;
      });
    } catch (error) {
      console.error("Error updating RSVP:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  const isGoing = userRsvp?.status === "going";
  const isInterested = userRsvp?.status === "interested";

  return (
    <div className="space-y-3">
      {/* RSVP Counts */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <UserCheck className="h-4 w-4 text-primary/80" />
          <strong className="text-foreground">{counts.going}</strong> going
        </span>
        <span className="flex items-center gap-1.5">
          <Star className="h-4 w-4 text-primary/80" />
          <strong className="text-foreground">{counts.interested}</strong> interested
        </span>
      </div>

      {/* RSVP Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => handleRsvp("going")}
          disabled={isSubmitting}
          variant={isGoing ? "default" : "outline"}
          className={cn(
            "flex-1 gap-2 transition-all duration-200",
            isGoing && "shadow-md"
          )}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isGoing ? (
            <X className="h-4 w-4" />
          ) : (
            <UserCheck className="h-4 w-4" />
          )}
          {isGoing ? "Cancel" : "Going"}
        </Button>

        <Button
          onClick={() => handleRsvp("interested")}
          disabled={isSubmitting}
          variant={isInterested ? "default" : "outline"}
          className={cn(
            "flex-1 gap-2 transition-all duration-200",
            isInterested && "shadow-md"
          )}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isInterested ? (
            <X className="h-4 w-4" />
          ) : (
            <Star className="h-4 w-4" />
          )}
          {isInterested ? "Cancel" : "Interested"}
        </Button>
      </div>
    </div>
  );
}
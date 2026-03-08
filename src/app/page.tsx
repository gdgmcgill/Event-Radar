"use client";

/**
 * Home page - Netflix-style event feed
 */

import { Suspense, useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Event } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { useEvents } from "@/hooks/useEvents";
import { HomeFeed } from "@/components/events/HomeFeed";
import { AlertCircle, X } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  not_mcgill: "Please sign in with a McGill email (@mcgill.ca or @mail.mcgill.ca).",
  auth_failed: "Authentication failed. Please try again.",
  no_code: "Authentication error. Please try again.",
  not_authenticated: "Could not verify your account. Please try again.",
};

export default function HomePage() {
  return (
    <Suspense>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const [localSavedIds, setLocalSavedIds] = useState<Set<string>>(new Set());
  const user = useAuthStore((s) => s.user);
  const { savedEventIds, isLoading: isSavedLoading } = useSavedEvents(!!user);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Sync server saved IDs into local state
  useEffect(() => {
    if (!isSavedLoading) {
      setLocalSavedIds(new Set(savedEventIds));
    }
  }, [savedEventIds, isSavedLoading]);

  const authError = useMemo(() => {
    const errorCode = searchParams.get("error");
    const signinRequired = searchParams.get("signin");
    if (errorCode && AUTH_ERROR_MESSAGES[errorCode]) {
      return AUTH_ERROR_MESSAGES[errorCode];
    } else if (signinRequired === "required") {
      return "Please sign in to access that page.";
    }
    return null;
  }, [searchParams]);

  useEffect(() => {
    if (authError) {
      router.replace("/");
    }
  }, [authError, router]);

  const todayStart = useMemo(() => {
    const dateOnly = new Date().toISOString().split("T")[0];
    return new Date(dateOnly);
  }, []);

  const upcomingFilters = useMemo(
    () => ({ dateRange: { start: todayStart } }),
    [todayStart]
  );

  const { events, loading } = useEvents({
    filters: upcomingFilters,
    limit: 50,
    sort: "start_date",
    direction: "asc",
  });

  const featuredEvents = useMemo(
    () => events.filter((e: Event) => e.image_url).slice(0, 5),
    [events]
  );

  const handleEventClick = useCallback(
    (eventId: string) => {
      router.push(`/events/${eventId}`);
    },
    [router]
  );

  const handleSaveEvent = useCallback(
    async (eventId: string) => {
      if (!user) return;
      const wasSaved = localSavedIds.has(eventId);

      // Optimistic update
      setLocalSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(eventId);
        else next.add(eventId);
        return next;
      });

      try {
        await fetch("/api/events/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: eventId }),
        });
      } catch {
        // Revert on failure
        setLocalSavedIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(eventId);
          else next.delete(eventId);
          return next;
        });
      }
    },
    [user, localSavedIds]
  );

  return (
    <ErrorBoundary fallbackMessage="We couldn't load events right now.">
      <div className="flex flex-col min-h-screen bg-background font-sans">
        {/* Auth Error Banner */}
        {authError && (
          <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3">
            <div className="container mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
              <button
                type="button"
                onClick={() => router.replace("/")}
                className="text-destructive/70 hover:text-destructive transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Netflix-style Home Feed */}
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ED1B2F]" />
          </div>
        ) : (
          <HomeFeed
            events={events}
            featuredEvents={featuredEvents}
            onEventClick={handleEventClick}
            onSaveEvent={handleSaveEvent}
            savedEventIds={Array.from(localSavedIds)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

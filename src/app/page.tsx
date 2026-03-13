"use client";

import { Suspense, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Event } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";
import { useEvents } from "@/hooks/useEvents";
import { HeroSection } from "@/components/events/HeroSection";
import { HappeningNowSection } from "@/components/events/HappeningNowSection";
import { PopularEventsSection } from "@/components/events/PopularEventsSection";
import { RecommendedEventsSection } from "@/components/events/RecommendedEventsSection";
import { FriendsActivitySection } from "@/components/events/FriendsActivitySection";
import { UpcomingThisWeekSection } from "@/components/events/UpcomingThisWeekSection";
import { CategoryRowsSection } from "@/components/events/CategoryRowsSection";
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
  const user = useAuthStore((s) => s.user);
  const searchParams = useSearchParams();
  const router = useRouter();

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
    limit: 100,
    sort: "start_date",
    direction: "asc",
  });

  const handleEventClick = useCallback(
    (event: Event) => {
      router.push(`/events/${event.id}`);
    },
    [router]
  );

  return (
    <ErrorBoundary fallbackMessage="We couldn't load events right now.">
      <div className="flex flex-col min-h-screen bg-background">
        {/* Auth Error Banner */}
        {authError && (
          <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3 relative z-50">
            <div className="flex items-center justify-between gap-4 px-6 md:px-10 lg:px-12">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
              <button
                type="button"
                onClick={() => router.replace("/")}
                className="text-destructive/70 hover:text-destructive transition-colors cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Hero Section — full bleed */}
        <HeroSection />

        {/* Discovery Feed Rows — Netflix-style vertical scroll */}
        <div className="pb-32 relative z-20 space-y-14">
          {/* Happening Now */}
          <HappeningNowSection onEventClick={handleEventClick} />

          {/* Trending Now (Popular) */}
          <PopularEventsSection onEventClick={handleEventClick} />

          {/* Recommended For You */}
          {user && <RecommendedEventsSection onEventClick={handleEventClick} />}

          {/* Friends Activity */}
          {user && <FriendsActivitySection />}

          {/* Upcoming This Week */}
          {!loading && events.length > 0 && (
            <UpcomingThisWeekSection events={events} onEventClick={handleEventClick} />
          )}

          {/* Category Rows — one horizontal row per category */}
          {!loading && events.length > 0 && (
            <CategoryRowsSection events={events} onEventClick={handleEventClick} />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}

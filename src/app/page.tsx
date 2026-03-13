"use client";

import { Suspense, useMemo, useCallback, useState, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Event, EventTag } from "@/types";
import { EVENT_TAGS, EVENT_CATEGORIES, QUICK_FILTERS } from "@/lib/constants";
import { useAuthStore } from "@/store/useAuthStore";
import { useEvents } from "@/hooks/useEvents";
import { HeroSection } from "@/components/events/HeroSection";
import { HappeningNowSection } from "@/components/events/HappeningNowSection";
import { PopularEventsSection } from "@/components/events/PopularEventsSection";
import { RecommendedEventsSection } from "@/components/events/RecommendedEventsSection";
import { FriendsActivitySection } from "@/components/events/FriendsActivitySection";
import { UpcomingThisWeekSection } from "@/components/events/UpcomingThisWeekSection";
import { CategoryRowsSection } from "@/components/events/CategoryRowsSection";
import { DiscoveryCard } from "@/components/events/DiscoveryCard";
import { EventSearch } from "@/components/events/EventSearch";
import { AlertCircle, X, SlidersHorizontal } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
  Heart,
  Code,
  Award,
  Mic,
  Handshake,
  UtensilsCrossed,
  Wrench,
  PartyPopper,
  Music,
  Dumbbell,
  Info,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
  Heart,
  Code,
  Award,
  Mic,
  Handshake,
  UtensilsCrossed,
  Wrench,
  PartyPopper,
  Music,
  Dumbbell,
  Info,
};

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
  const feedRef = useRef<HTMLDivElement>(null);

  // Search & filter state — tags are strings (both EventTag values and raw DB tags)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const isFiltering = searchQuery.trim().length > 0 || selectedTags.length > 0;

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

  // Default feed events (upcoming)
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

  // Filtered events (only fetched when user is searching/filtering)
  const filteredFilters = useMemo(
    () => ({
      dateRange: { start: todayStart },
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      searchQuery: searchQuery.trim() || undefined,
    }),
    [todayStart, selectedTags, searchQuery]
  );

  const {
    events: filteredEvents,
    loading: filteredLoading,
    loadMore,
    nextCursor,
    loadingMore,
  } = useEvents({
    filters: filteredFilters,
    limit: 30,
    sort: "start_date",
    direction: "asc",
    enabled: isFiltering,
  });

  const handleEventClick = useCallback(
    (event: Event) => {
      router.push(`/events/${event.id}`);
    },
    [router]
  );

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedTags([]);
  }, []);

  const handleCategoryClick = useCallback((tag: EventTag) => {
    setSelectedTags([tag]);
    feedRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Scroll to feed when filters change
  useEffect(() => {
    if (isFiltering && feedRef.current) {
      feedRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedTags]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build a lookup for quick filter metadata by tag string
  const quickFilterMap = useMemo(
    () => new Map(QUICK_FILTERS.map((qf) => [qf.tag, qf])),
    []
  );

  // Get display info for an active tag (either broad category or quick filter)
  const getTagDisplay = useCallback(
    (tag: string) => {
      // Check broad categories first
      if (EVENT_CATEGORIES[tag as EventTag]) {
        return { label: EVENT_CATEGORIES[tag as EventTag].label, badgeTheme: EVENT_CATEGORIES[tag as EventTag].badgeTheme };
      }
      // Check quick filters
      const qf = quickFilterMap.get(tag);
      if (qf) return { label: qf.label, badgeTheme: qf.badgeTheme };
      return { label: tag, badgeTheme: "" };
    },
    [quickFilterMap]
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

        {/* Search & Filter Bar — sticky below hero */}
        <div
          ref={feedRef}
          className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40"
        >
          <div className="px-6 md:px-10 lg:px-12 py-4 space-y-3">
            {/* Search Row */}
            <div className="flex items-center gap-3">
              <EventSearch
                onSearchChange={setSearchQuery}
                placeholder="Search events, clubs, categories..."
                variant="compact"
                className="max-w-none flex-1"
              />
              {isFiltering && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-destructive bg-secondary/60 hover:bg-secondary rounded-lg transition-all cursor-pointer whitespace-nowrap"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>

            {/* Filter Pills — broad categories + quick filters */}
            <div className="flex items-center gap-2 overflow-x-auto py-1.5 px-0.5 -mx-0.5 scrollbar-none">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

              {/* Broad categories */}
              {EVENT_TAGS.map((tag) => {
                const category = EVENT_CATEGORIES[tag];
                const Icon = ICON_MAP[category.icon] || Heart;
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    aria-pressed={isSelected}
                    className={cn(
                      "relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 border whitespace-nowrap cursor-pointer shrink-0",
                      isSelected
                        ? category.badgeTheme
                        : "bg-secondary/40 text-secondary-foreground border-transparent hover:bg-secondary/80 hover:scale-[1.02]"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {category.label}
                  </button>
                );
              })}

              {/* Divider */}
              <div className="w-px h-5 bg-border/60 shrink-0 mx-1" />

              {/* Quick filters */}
              {QUICK_FILTERS.map((qf) => {
                const Icon = ICON_MAP[qf.icon] || Heart;
                const isSelected = selectedTags.includes(qf.tag);
                return (
                  <button
                    key={qf.tag}
                    onClick={() => toggleTag(qf.tag)}
                    aria-pressed={isSelected}
                    className={cn(
                      "relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 border whitespace-nowrap cursor-pointer shrink-0",
                      isSelected
                        ? qf.badgeTheme
                        : "bg-secondary/40 text-secondary-foreground border-transparent hover:bg-secondary/80 hover:scale-[1.02]"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {qf.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content */}
        {isFiltering ? (
          /* Filtered Results */
          <div className="px-6 md:px-10 lg:px-12 py-8">
            {/* Active Filters Summary */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-foreground">
                  {filteredLoading
                    ? "Searching..."
                    : `${filteredEvents.length} result${filteredEvents.length !== 1 ? "s" : ""}`}
                </h2>
                {selectedTags.length > 0 && (
                  <div className="flex items-center gap-1.5 ml-2 flex-wrap">
                    {selectedTags.map((tag) => {
                      const { label, badgeTheme } = getTagDisplay(tag);
                      return (
                        <span
                          key={tag}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border",
                            badgeTheme
                          )}
                        >
                          {label}
                          <button
                            onClick={() => toggleTag(tag)}
                            className="hover:opacity-70 transition-opacity cursor-pointer"
                            aria-label={`Remove ${label} filter`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Results Grid */}
            {filteredLoading && filteredEvents.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[16/10] rounded-3xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <SlidersHorizontal className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">No events found</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  Try adjusting your search or filters to find what you&apos;re looking for.
                </p>
                <button
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredEvents.map((event) => (
                    <DiscoveryCard
                      key={event.id}
                      event={event}
                      onClick={() => handleEventClick(event)}
                    />
                  ))}
                </div>
                {nextCursor && (
                  <div className="flex justify-center mt-8">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="px-6 py-2.5 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                    >
                      {loadingMore ? "Loading..." : "Load More"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* Discovery Feed Rows — Netflix-style vertical scroll */
          <div id="discovery-feed" className="pb-32 relative z-20 space-y-14 pt-6">
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
              <CategoryRowsSection
                events={events}
                onEventClick={handleEventClick}
                onCategoryClick={handleCategoryClick}
              />
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

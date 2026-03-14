"use client";

/**
 * Calendar page - Monthly calendar view of events
 * Design: Stitch calendar layout with sidebar filters, featured section, and footer
 */

import { useState, useEffect, useRef, useMemo } from "react";
import type { Event, EventTag } from "@/types";
import { EventDetailsModal } from "@/components/events/EventDetailsModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CalendarOff,
  Share,
  RefreshCw,
  Star,
  Compass,
  BookOpen,
  Rocket,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { useTracking } from "@/hooks/useTracking";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { useEvents } from "@/hooks/useEvents";

/** Map each tag to its Stitch-design sidebar color */
const CATEGORY_SIDEBAR_COLORS: Record<
  string,
  { bg: string; border: string; text: string; ring: string }
> = {
  academic: {
    bg: "bg-blue-500",
    border: "border-blue-500",
    text: "text-blue-600",
    ring: "ring-blue-500/50",
  },
  social: {
    bg: "bg-red-600",
    border: "border-red-600",
    text: "text-red-600",
    ring: "ring-red-600/50",
  },
  sports: {
    bg: "bg-orange-500",
    border: "border-orange-500",
    text: "text-orange-600",
    ring: "ring-orange-500/50",
  },
  career: {
    bg: "bg-emerald-500",
    border: "border-emerald-500",
    text: "text-emerald-600",
    ring: "ring-emerald-500/50",
  },
  cultural: {
    bg: "bg-purple-500",
    border: "border-purple-500",
    text: "text-purple-600",
    ring: "ring-purple-500/50",
  },
  wellness: {
    bg: "bg-pink-500",
    border: "border-pink-500",
    text: "text-pink-600",
    ring: "ring-pink-500/50",
  },
};

/** Map each tag to the event strip colors used inside calendar cells */
const CATEGORY_STRIP_COLORS: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  academic: {
    bg: "bg-blue-500/10",
    border: "border-blue-500",
    text: "text-blue-600",
  },
  social: {
    bg: "bg-red-600/10",
    border: "border-red-600",
    text: "text-red-600",
  },
  sports: {
    bg: "bg-orange-500/10",
    border: "border-orange-500",
    text: "text-orange-600",
  },
  career: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500",
    text: "text-emerald-600",
  },
  cultural: {
    bg: "bg-purple-500/10",
    border: "border-purple-500",
    text: "text-purple-600",
  },
  wellness: {
    bg: "bg-pink-500/10",
    border: "border-pink-500",
    text: "text-pink-600",
  },
};

/** Get the primary category strip color for an event */
function getEventStripClasses(tags: EventTag[]) {
  const primary = tags?.[0];
  return (
    CATEGORY_STRIP_COLORS[primary] ?? {
      bg: "bg-red-600/10",
      border: "border-red-600",
      text: "text-red-600",
    }
  );
}

/** Get the badge bg color for featured cards */
function getFeaturedBadgeBg(tags: EventTag[]) {
  const primary = tags?.[0];
  return CATEGORY_SIDEBAR_COLORS[primary]?.bg ?? "bg-red-600";
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    () => new Set(Object.keys(EVENT_CATEGORIES))
  );
  const [calendarView, setCalendarView] = useState<"Month" | "Week" | "Day">(
    "Month"
  );

  const now = new Date();
  const startOfMonthRef = useRef(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );

  const { events, loading, loadAll } = useEvents({
    enabled: false,
    limit: 100,
    sort: "start_date",
    direction: "asc",
  });

  useEffect(() => {
    loadAll({
      filters: {
        dateRange: {
          start: startOfMonthRef.current,
        },
      },
    });
  }, [loadAll]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return events.filter(
      (event: Event) =>
        event.event_date === dateStr &&
        event.tags?.some((t) => selectedCategories.has(t))
    );
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev: Date) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const toggleCategory = (tag: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const { daysInMonth, startingDayOfWeek, year, month } =
    getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const showSkeleton = loading && events.length === 0;
  const showSpinner = loading && !showSkeleton;

  // Create calendar grid
  const calendarDays: (Date | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }
  // Pad trailing cells so we fill complete weeks
  while (calendarDays.length % 7 !== 0) {
    calendarDays.push(null);
  }

  const { trackClick } = useTracking({ source: "calendar" });

  const handleEventClick = (event: Event) => {
    trackClick(event.id);
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  // Featured events: next 7 days from today that match selected categories
  const featuredEvents = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];
    return events
      .filter(
        (e) =>
          e.event_date >= startStr &&
          e.event_date <= endStr &&
          e.tags?.some((t) => selectedCategories.has(t))
      )
      .slice(0, 3);
  }, [events, selectedCategories]);

  return (
    <ErrorBoundary fallbackMessage="We couldn't load the calendar right now.">
      <>
        <main className="flex flex-1 flex-col px-4 md:px-10 lg:px-20 py-8">
          {/* Page Header & Sync */}
          <div className="flex flex-wrap justify-between items-end gap-6 mb-8">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  McGill Edition
                </span>
              </div>
              <h1 className="text-slate-900 dark:text-slate-100 text-4xl font-black leading-tight tracking-tight">
                Event Calendar
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-lg">
                Never miss a moment of the McGill experience.
              </p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center justify-center gap-2 rounded-lg h-12 px-6 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-all">
                <Share className="h-5 w-5" />
                <span>Export</span>
              </button>
              <button className="flex items-center justify-center gap-2 rounded-lg h-12 px-6 bg-red-600 text-white font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-red-600/25">
                <RefreshCw className="h-5 w-5" />
                <span>Sync to My Calendar</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Side Filters */}
            <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-6">
              <div className="bg-white dark:bg-slate-900/50 p-6 rounded-xl border border-red-600/5 shadow-sm">
                <h3 className="text-slate-900 dark:text-slate-100 font-bold text-sm mb-4 uppercase tracking-widest">
                  Categories
                </h3>
                <div className="flex flex-col gap-3">
                  {Object.entries(EVENT_CATEGORIES).map(([tag, category]) => {
                    const colors = CATEGORY_SIDEBAR_COLORS[tag];
                    const isSelected = selectedCategories.has(tag);
                    return (
                      <label
                        key={tag}
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => toggleCategory(tag)}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded border-2 ring-offset-2 group-hover:ring-2",
                            colors?.border,
                            colors?.ring,
                            isSelected
                              ? colors?.bg
                              : "bg-transparent"
                          )}
                        />
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100">
                          {category.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900/50 p-6 rounded-xl border border-red-600/5 shadow-sm">
                <h3 className="text-slate-900 dark:text-slate-100 font-bold text-sm mb-4 uppercase tracking-widest">
                  Quick Links
                </h3>
                <ul className="flex flex-col gap-4">
                  <li className="flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:text-red-600 transition-colors cursor-pointer">
                    <Star className="h-[18px] w-[18px]" />
                    <span className="text-sm font-medium">My Favorites</span>
                  </li>
                  <li className="flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:text-red-600 transition-colors cursor-pointer">
                    <Compass className="h-[18px] w-[18px]" />
                    <span className="text-sm font-medium">Campus Map</span>
                  </li>
                  <li className="flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:text-red-600 transition-colors cursor-pointer">
                    <BookOpen className="h-[18px] w-[18px]" />
                    <span className="text-sm font-medium">Resources</span>
                  </li>
                </ul>
              </div>
            </aside>

            {/* Main Calendar View */}
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-red-600/10 shadow-xl overflow-hidden">
              {/* Calendar Controls */}
              <div className="flex items-center justify-between p-6 border-b border-red-600/5">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                    {monthName}
                    {showSpinner && (
                      <span className="ml-2 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-red-600/30 border-t-red-600 align-[-2px]" />
                    )}
                  </h2>
                  <div className="flex bg-red-50 dark:bg-red-950/30 rounded-lg p-1">
                    <button
                      className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded shadow-sm transition-all"
                      onClick={() => navigateMonth("prev")}
                      disabled={loading}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded shadow-sm transition-all"
                      onClick={() => navigateMonth("next")}
                      disabled={loading}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                  {(["Month", "Week", "Day"] as const).map((view) => (
                    <button
                      key={view}
                      onClick={() => setCalendarView(view)}
                      className={cn(
                        "px-4 py-1 text-sm font-medium rounded transition-all",
                        calendarView === view
                          ? "bg-white dark:bg-slate-700 text-red-600 font-bold shadow-sm"
                          : "text-slate-600 dark:text-slate-400"
                      )}
                    >
                      {view}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Header */}
              <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-800/50 border-b border-red-600/5">
                {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(
                  (day) => (
                    <div
                      key={day}
                      className="py-3 text-center text-xs font-black uppercase tracking-widest text-slate-500"
                    >
                      {day}
                    </div>
                  )
                )}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 flex-1">
                {showSkeleton
                  ? Array.from({ length: calendarDays.length }).map(
                      (_, index) => (
                        <div
                          key={`skeleton-${index}`}
                          className="border-r border-b border-red-600/5 p-2 h-32"
                        >
                          <div className="h-full flex flex-col gap-2">
                            <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
                            <div className="h-4 w-3/4 rounded-md bg-muted animate-pulse" />
                            <div className="h-4 w-2/3 rounded-md bg-muted animate-pulse" />
                          </div>
                        </div>
                      )
                    )
                  : calendarDays.map((date, index) => {
                      if (!date) {
                        // Empty cells (before month start or trailing)
                        return (
                          <div
                            key={`empty-${index}`}
                            className="border-r border-b border-red-600/5 p-2 h-32 bg-slate-50 dark:bg-slate-800/10"
                          />
                        );
                      }

                      const dateStr = date.toISOString().split("T")[0];
                      const dayEvents = getEventsForDate(date);
                      const isToday = dateStr === todayStr;
                      const isPast =
                        date < today && dateStr !== todayStr;

                      return (
                        <div
                          key={dateStr}
                          className={cn(
                            "border-r border-b border-red-600/5 p-2 h-32 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex flex-col gap-1",
                            isToday &&
                              "bg-red-600/5 ring-1 ring-inset ring-red-600/20"
                          )}
                        >
                          <span
                            className={cn(
                              "text-sm font-bold",
                              isToday && "text-red-600",
                              !isToday && isPast && "text-slate-400",
                              !isToday && !isPast && "text-slate-400"
                            )}
                          >
                            {date.getDate()}
                          </span>

                          {dayEvents.slice(0, 3).map((event) => {
                            const strip = getEventStripClasses(event.tags);
                            return (
                              <button
                                key={event.id}
                                onClick={() => handleEventClick(event)}
                                className={cn(
                                  "w-full text-left border-l-2 p-1 rounded-sm",
                                  strip.bg,
                                  strip.border
                                )}
                              >
                                <p
                                  className={cn(
                                    "text-[10px] font-bold truncate leading-tight",
                                    strip.text
                                  )}
                                >
                                  {event.title}
                                </p>
                              </button>
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <button
                              onClick={() =>
                                handleEventClick(dayEvents[3])
                              }
                              className="w-full text-left px-1 text-[10px] text-red-600 hover:underline font-bold"
                            >
                              +{dayEvents.length - 3} more
                            </button>
                          )}
                        </div>
                      );
                    })}
              </div>
            </div>
          </div>

          {/* Empty State */}
          {!loading && events.length === 0 && (
            <div className="mt-6">
              <EmptyState
                icon={CalendarOff}
                title="No events this month"
                description="Check back soon or browse all upcoming events."
                action={{ label: "Browse Events", href: "/" }}
              />
            </div>
          )}

          {/* Featured This Week */}
          {featuredEvents.length > 0 && (
            <div className="mt-12">
              <h3 className="text-slate-900 dark:text-slate-100 font-black text-xl mb-6">
                Featured This Week
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredEvents.map((event) => {
                  const badgeBg = getFeaturedBadgeBg(event.tags);
                  const eventDate = new Date(event.event_date + "T00:00:00");
                  const monthShort = eventDate.toLocaleDateString("en-US", {
                    month: "short",
                  });
                  const dayNum = String(eventDate.getDate()).padStart(2, "0");

                  return (
                    <button
                      key={event.id}
                      onClick={() => handleEventClick(event)}
                      className="group flex gap-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-red-600/5 hover:border-red-600/20 hover:shadow-lg transition-all cursor-pointer text-left"
                    >
                      <div className="size-16 rounded-lg overflow-hidden shrink-0">
                        <div
                          className={cn(
                            "w-full h-full flex flex-col items-center justify-center text-white",
                            badgeBg
                          )}
                        >
                          <span className="text-xs font-bold uppercase">
                            {monthShort}
                          </span>
                          <span className="text-xl font-black leading-none">
                            {dayNum}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col justify-center min-w-0">
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-red-600 transition-colors truncate">
                          {event.title}
                        </h4>
                        <p className="text-xs text-slate-500 truncate">
                          {event.location}
                          {event.event_time
                            ? ` \u2022 ${event.event_time}`
                            : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white dark:bg-slate-900 border-t border-red-600/10 py-10 px-6 md:px-20 mt-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3 text-red-600">
              <Rocket className="h-5 w-5" />
              <span className="font-black text-slate-900 dark:text-slate-100">
                Uni-Verse McGill
              </span>
            </div>
            <div className="flex gap-8">
              <a
                className="text-sm text-slate-500 hover:text-red-600"
                href="#"
              >
                About
              </a>
              <a
                className="text-sm text-slate-500 hover:text-red-600"
                href="#"
              >
                Contact
              </a>
              <a
                className="text-sm text-slate-500 hover:text-red-600"
                href="#"
              >
                Privacy Policy
              </a>
            </div>
            <p className="text-sm text-slate-400">
              &copy; 2024 Uni-Verse McGill Edition. All rights reserved.
            </p>
          </div>
        </footer>

        {/* Event Details Modal */}
        <EventDetailsModal
          open={isModalOpen}
          onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) setSelectedEvent(null);
          }}
          event={selectedEvent}
          trackingSource="calendar"
        />
      </>
    </ErrorBoundary>
  );
}

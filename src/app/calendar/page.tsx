"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import type { Event, EventTag } from "@/types";
import { EventDetailsModal } from "@/components/events/EventDetailsModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SignInButton } from "@/components/auth/SignInButton";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTracking } from "@/hooks/useTracking";
import { exportEventsCsv } from "@/lib/exportUtils";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Download,
  CalendarOff,
  LogIn,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Sparkles,
  Calendar as CalendarIcon,
  AlertCircle,
  RefreshCcw,
  ChevronsDown,
  Loader2,
  ArrowUpDown,
  FileSpreadsheet,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════
   Category color maps
   ═══════════════════════════════════════════════════════ */

const STRIP_COLORS: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  academic: {
    bg: "bg-blue-500/20",
    border: "border-blue-500/30",
    text: "text-blue-600 dark:text-blue-400",
  },
  social: {
    bg: "bg-pink-500/20",
    border: "border-pink-500/30",
    text: "text-pink-600 dark:text-pink-400",
  },
  sports: {
    bg: "bg-green-500/20",
    border: "border-green-500/30",
    text: "text-green-600 dark:text-green-400",
  },
  career: {
    bg: "bg-purple-500/20",
    border: "border-purple-500/30",
    text: "text-purple-600 dark:text-purple-400",
  },
  cultural: {
    bg: "bg-orange-500/20",
    border: "border-orange-500/30",
    text: "text-orange-600 dark:text-orange-400",
  },
  wellness: {
    bg: "bg-teal-500/20",
    border: "border-teal-500/30",
    text: "text-teal-600 dark:text-teal-400",
  },
};

const ACCENT_COLORS: Record<
  string,
  { bar: string; label: string; hoverBorder: string }
> = {
  academic: {
    bar: "bg-blue-500",
    label: "text-blue-600 dark:text-blue-400",
    hoverBorder: "hover:border-blue-500/50",
  },
  social: {
    bar: "bg-pink-500",
    label: "text-pink-600 dark:text-pink-400",
    hoverBorder: "hover:border-pink-500/50",
  },
  sports: {
    bar: "bg-green-500",
    label: "text-green-600 dark:text-green-400",
    hoverBorder: "hover:border-green-500/50",
  },
  career: {
    bar: "bg-purple-500",
    label: "text-purple-600 dark:text-purple-400",
    hoverBorder: "hover:border-purple-500/50",
  },
  cultural: {
    bar: "bg-orange-500",
    label: "text-orange-600 dark:text-orange-400",
    hoverBorder: "hover:border-orange-500/50",
  },
  wellness: {
    bar: "bg-teal-500",
    label: "text-teal-600 dark:text-teal-400",
    hoverBorder: "hover:border-teal-500/50",
  },
};

const DOT_COLORS: Record<string, string> = {
  academic: "bg-blue-500",
  social: "bg-pink-500",
  sports: "bg-green-500",
  career: "bg-purple-500",
  cultural: "bg-orange-500",
  wellness: "bg-teal-500",
};

const DEFAULT_STRIP = {
  bg: "bg-primary/20",
  border: "border-primary/30",
  text: "text-primary",
};
const DEFAULT_ACCENT = {
  bar: "bg-primary",
  label: "text-primary",
  hoverBorder: "hover:border-primary/50",
};

function getStripColors(tags?: EventTag[]) {
  const primary = tags?.[0];
  return primary ? (STRIP_COLORS[primary] ?? DEFAULT_STRIP) : DEFAULT_STRIP;
}

function getAccentColors(tags?: EventTag[]) {
  const primary = tags?.[0];
  return primary
    ? (ACCENT_COLORS[primary] ?? DEFAULT_ACCENT)
    : DEFAULT_ACCENT;
}

/* ═══════════════════════════════════════════════════════
   Calendar helpers
   ═══════════════════════════════════════════════════════ */

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDay = firstDay.getDay();

  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  const prevMonthEnd = new Date(year, month, 0).getDate();
  for (let i = startingDay - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevMonthEnd - i),
      isCurrentMonth: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }

  let nextDay = 1;
  while (days.length % 7 !== 0) {
    days.push({
      date: new Date(year, month + 1, nextDay++),
      isCurrentMonth: false,
    });
  }

  return days;
}

function getWeekDays(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTime(time: string) {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

function formatDateHeading(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Compute a date range that covers the visible grid for a given month. */
function getMonthFetchRange(year: number, month: number) {
  const first = new Date(year, month, 1);
  const from = new Date(first);
  from.setDate(from.getDate() - first.getDay()); // back to Sunday
  const last = new Date(year, month + 1, 0);
  const to = new Date(last);
  to.setDate(to.getDate() + (6 - last.getDay())); // forward to Saturday
  return { from: dateKey(from), to: dateKey(to) };
}

function getWeekFetchRange(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  const from = dateKey(d);
  d.setDate(d.getDate() + 6);
  const to = dateKey(d);
  return { from, to };
}

/* ═══════════════════════════════════════════════════════
   iCal export
   ═══════════════════════════════════════════════════════ */

function escapeIcal(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function generateIcal(events: CalendarEvent[]) {
  const lb = "\r\n";
  const dtstamp =
    new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .split(".")[0] + "Z";

  const vevents = events.map((event) => {
    const datePart = event.event_date.replace(/-/g, "");
    const timePart = event.event_time
      ? event.event_time.replace(":", "") + "00"
      : "000000";

    return [
      "BEGIN:VEVENT",
      `UID:${event.id}@uni-verse`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${datePart}T${timePart}`,
      `SUMMARY:${escapeIcal(event.title)}`,
      `DESCRIPTION:${escapeIcal(event.description || "")}`,
      `LOCATION:${escapeIcal(event.location || "")}`,
      "END:VEVENT",
    ].join(lb);
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Uni-Verse//EN",
    "CALSCALE:GREGORIAN",
    ...vevents,
    "END:VCALENDAR",
  ].join(lb);
}

function downloadIcal(events: CalendarEvent[]) {
  const ical = generateIcal(events);
  const blob = new Blob([ical], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "uni-verse-calendar.ics";
  a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

type CalendarEvent = Omit<Event, "club"> & {
  club?: { id: string; name: string; logo_url: string | null };
  is_saved?: boolean;
  rsvp_status?: string | null;
};

type CalendarView = "Month" | "Week" | "Saved";

type SortOption = "date" | "recent" | "title";
const SORT_LABELS: Record<SortOption, string> = {
  date: "Event Date",
  recent: "Recently Saved",
  title: "Title A-Z",
};

/* ═══════════════════════════════════════════════════════
   useTodayStr — refreshes at midnight so "today" never goes stale
   ═══════════════════════════════════════════════════════ */

function useTodayStr() {
  const [today, setToday] = useState(() => dateKey(new Date()));

  useEffect(() => {
    const check = () => {
      const now = dateKey(new Date());
      if (now !== today) setToday(now);
    };
    // Check every 30s — lightweight and catches midnight rollover
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [today]);

  return today;
}

/* ═══════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════ */

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read initial view from URL first, then localStorage, then default to Saved
  const initialView = useMemo(() => {
    const v = searchParams.get("view");
    if (v === "Week" || v === "Saved" || v === "Month") return v;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("universe_calendar_view");
      if (stored === "Month" || stored === "Week" || stored === "Saved") return stored;
    }
    return "Saved" as CalendarView;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [calendarView, setCalendarView] = useState<CalendarView>(initialView);
  const [prevView, setPrevView] = useState<CalendarView>(initialView);
  const [transitioning, setTransitioning] = useState(false);
  const [busyActions, setBusyActions] = useState<Set<string>>(new Set());
  // List view sort + export
  const [listSort, setListSort] = useState<SortOption>("date");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const agendaRef = useRef<HTMLDivElement>(null);

  const { trackClick } = useTracking({ source: "calendar" });
  const todayStr = useTodayStr();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthGrid = useMemo(
    () => buildMonthGrid(year, month),
    [year, month]
  );

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  const selectedStr = dateKey(selectedDate);

  // Stable key for the current week — only changes when we cross into a different week
  const weekRangeKey = useMemo(() => {
    const { from } = getWeekFetchRange(selectedDate);
    return from;
  }, [selectedDate]);

  // Index events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = event.event_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [events]);

  const selectedDayEvents = useMemo(
    () => eventsByDate.get(selectedStr) || [],
    [eventsByDate, selectedStr]
  );

  // All events for list view, sorted by user preference
  const listEvents = useMemo(() => {
    const sorted = [...events];
    switch (listSort) {
      case "date":
        sorted.sort((a, b) => {
          const dc = a.event_date.localeCompare(b.event_date);
          if (dc !== 0) return dc;
          return (a.event_time || "").localeCompare(b.event_time || "");
        });
        break;
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "recent":
        // Keep original order (API returns by start_date, most recent saves first for list)
        sorted.reverse();
        break;
    }
    return sorted;
  }, [events, listSort]);

  const groupedList = useMemo(() => {
    // Only group by date when sorting by date
    if (listSort !== "date") return null;
    const groups: { date: string; events: CalendarEvent[] }[] = [];
    for (const event of listEvents) {
      const last = groups[groups.length - 1];
      if (last && last.date === event.event_date) {
        last.events.push(event);
      } else {
        groups.push({ date: event.event_date, events: [event] });
      }
    }
    return groups;
  }, [listEvents, listSort]);

  /* ── Data fetching with date-range ── */

  // Stable fetch URL — only changes when the actual date range changes
  const fetchUrl = useMemo(() => {
    const base = "/api/calendar/events";
    if (calendarView === "Month") {
      const { from, to } = getMonthFetchRange(year, month);
      return `${base}?from=${from}&to=${to}`;
    }
    if (calendarView === "Week") {
      const { from, to } = getWeekFetchRange(new Date(weekRangeKey + "T00:00:00"));
      return `${base}?from=${from}&to=${to}`;
    }
    return base; // List view — no date filter
  }, [calendarView, year, month, weekRangeKey]);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(fetchUrl);
      if (!res.ok) {
        // Don't hard-error on auth issues — user might be mid-session-refresh
        if (res.status === 401) {
          setEvents([]);
          return;
        }
        const body = await res.json().catch(() => ({}));
        console.error("Calendar API error:", res.status, body);
        throw new Error(body?.error || "Failed to fetch calendar events");
      }
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error("Calendar fetch error:", err);
      setError("Failed to load your events. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [fetchUrl]);

  useEffect(() => {
    if (user) fetchEvents();
    else setLoading(false);
  }, [user, fetchEvents]);

  /* ── View switching with transition ── */

  const switchView = (view: CalendarView) => {
    if (view === calendarView) return;
    setPrevView(calendarView);
    setTransitioning(true);
    setTimeout(() => {
      setCalendarView(view);
      setTransitioning(false);
      // Persist view preference
      try { localStorage.setItem("universe_calendar_view", view); } catch {}
      // Sync URL without full navigation
      const url = new URL(window.location.href);
      if (view === "Saved") {
        url.searchParams.delete("view");
      } else {
        url.searchParams.set("view", view);
      }
      router.replace(url.pathname + url.search, { scroll: false });
    }, 150);
  };

  /* ── CSV export ── */

  const handleExportCsv = async () => {
    if (events.length === 0) return;
    try {
      setIsExportingCsv(true);
      await exportEventsCsv(
        events.map((e) => e.id),
        "my-events.csv"
      );
    } catch (err) {
      console.error("CSV export error:", err);
    } finally {
      setIsExportingCsv(false);
    }
  };

  /* ── Navigation ── */

  const navigateMonth = (dir: "prev" | "next") => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + (dir === "next" ? 1 : -1));
      return d;
    });
  };

  const navigateWeek = (dir: "prev" | "next") => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + (dir === "next" ? 7 : -7));
    setSelectedDate(d);
    setCurrentDate(d);
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    if (
      date.getMonth() !== currentDate.getMonth() ||
      date.getFullYear() !== currentDate.getFullYear()
    ) {
      setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
    }
    // On mobile, scroll to agenda
    if (window.innerWidth < 1024 && agendaRef.current) {
      setTimeout(() => {
        agendaRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    trackClick(event.id);
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  /* ── Keyboard navigation ── */

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    const step =
      calendarView === "Month"
        ? { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }
        : { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1 };

    const delta = step[e.key as keyof typeof step];

    if (delta !== undefined) {
      e.preventDefault();
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + delta);
      setSelectedDate(newDate);

      if (
        newDate.getMonth() !== currentDate.getMonth() ||
        newDate.getFullYear() !== currentDate.getFullYear()
      ) {
        setCurrentDate(
          new Date(newDate.getFullYear(), newDate.getMonth(), 1)
        );
      }
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const dayEvts = eventsByDate.get(dateKey(selectedDate));
      if (dayEvts?.[0]) handleEventClick(dayEvts[0]);
    }
  };

  /* ── Save / RSVP actions ── */

  const addBusy = (key: string) =>
    setBusyActions((prev) => new Set(prev).add(key));
  const removeBusy = (key: string) =>
    setBusyActions((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

  const toggleSave = async (event: CalendarEvent) => {
    const actionKey = `save-${event.id}`;
    if (busyActions.has(actionKey)) return;

    const wasSaved = event.is_saved;
    addBusy(actionKey);

    setEvents((prev) =>
      prev.map((e) =>
        e.id === event.id ? { ...e, is_saved: !wasSaved } : e
      )
    );

    try {
      const res = await fetch(`/api/events/${event.id}/save`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      if (!data.saved && !event.rsvp_status) {
        setEvents((prev) => prev.filter((e) => e.id !== event.id));
      }
    } catch {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id ? { ...e, is_saved: wasSaved } : e
        )
      );
    } finally {
      removeBusy(actionKey);
    }
  };

  const setRsvp = async (
    event: CalendarEvent,
    status: "going" | "interested"
  ) => {
    if (!user) return;
    const actionKey = `rsvp-${event.id}`;
    if (busyActions.has(actionKey)) return;

    const prevStatus = event.rsvp_status;
    const isCancel = prevStatus === status;
    addBusy(actionKey);

    setEvents((prev) =>
      prev.map((e) =>
        e.id === event.id
          ? { ...e, rsvp_status: isCancel ? null : status }
          : e
      )
    );

    try {
      if (isCancel) {
        const res = await fetch(`/api/events/${event.id}/rsvp`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id }),
        });
        if (!res.ok) throw new Error();

        if (!event.is_saved) {
          setEvents((prev) => prev.filter((e) => e.id !== event.id));
        }
      } else {
        const res = await fetch(`/api/events/${event.id}/rsvp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id, status }),
        });
        if (!res.ok) throw new Error();
      }
    } catch {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id ? { ...e, rsvp_status: prevStatus } : e
        )
      );
    } finally {
      removeBusy(actionKey);
    }
  };

  /* ── Derived labels ── */

  const monthLabel = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const weekLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${start.toLocaleDateString("en-US", { month: "long" })} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${start.toLocaleDateString("en-US", { month: "short" })} ${start.getDate()} – ${end.toLocaleDateString("en-US", { month: "short" })} ${end.getDate()}, ${end.getFullYear()}`;
  }, [weekDays]);

  const selectedDateLabel = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const navLabel = calendarView === "Week" ? weekLabel : monthLabel;

  /* ── Early returns ── */

  if (authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh] px-4">
        <div className="flex flex-col items-center justify-center text-center space-y-4 bg-card/50 rounded-xl border border-border backdrop-blur-sm p-10 max-w-md">
          <div className="rounded-full bg-primary/10 p-4">
            <LogIn className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground">
            Sign in to view your calendar
          </h3>
          <p className="text-muted-foreground">
            Your saved and RSVP&apos;d events will appear here once you sign
            in.
          </p>
          <SignInButton variant="default" />
        </div>
      </div>
    );
  }

  /* ── Agenda card renderer ── */

  const renderAgendaCard = (event: CalendarEvent) => {
    const accent = getAccentColors(event.tags);
    const saveBusy = busyActions.has(`save-${event.id}`);
    const rsvpBusy = busyActions.has(`rsvp-${event.id}`);

    return (
      <div
        key={event.id}
        className={cn(
          "group relative flex flex-col gap-3 rounded-2xl bg-background border border-border p-4 transition-colors overflow-hidden",
          accent.hoverBorder
        )}
      >
        <div
          className={cn(
            "absolute top-0 left-0 w-1 h-full rounded-l-2xl",
            accent.bar
          )}
        />

        <button
          onClick={() => handleEventClick(event)}
          className="flex flex-col gap-3 text-left cursor-pointer"
        >
          <div className="flex justify-between items-start pl-3">
            <div className="flex flex-col gap-1 min-w-0">
              <span
                className={cn(
                  "text-xs font-semibold tracking-wider uppercase",
                  accent.label
                )}
              >
                {event.club?.name || "Event"}
              </span>
              <h4 className="text-foreground text-base font-bold leading-tight group-hover:text-primary transition-colors truncate">
                {event.title}
              </h4>
            </div>
          </div>

          <div className="flex flex-col gap-2 pl-3">
            {event.event_time && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Clock className="h-4 w-4 shrink-0" />
                <span>{formatTime(event.event_time)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          </div>
        </button>

        {/* Action bar */}
        <div className="flex items-center gap-2 pl-3 pt-2 border-t border-border/60 flex-wrap">
          <button
            onClick={() => toggleSave(event)}
            disabled={saveBusy}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait",
              event.is_saved
                ? "bg-primary/10 border border-primary/20 text-primary"
                : "bg-secondary border border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {saveBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : event.is_saved ? (
              <BookmarkCheck className="h-3 w-3" />
            ) : (
              <Bookmark className="h-3 w-3" />
            )}
            {event.is_saved ? "Saved" : "Save"}
          </button>

          <button
            onClick={() => setRsvp(event, "going")}
            disabled={rsvpBusy}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait",
              event.rsvp_status === "going"
                ? "bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400"
                : "bg-secondary border border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {rsvpBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            Going
          </button>

          <button
            onClick={() => setRsvp(event, "interested")}
            disabled={rsvpBusy}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait",
              event.rsvp_status === "interested"
                ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                : "bg-secondary border border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {rsvpBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            Interested
          </button>
        </div>
      </div>
    );
  };

  /* ── Day cell renderer ── */

  const renderDayCell = (
    date: Date,
    isCurrentPeriod: boolean,
    tall: boolean
  ) => {
    const key = dateKey(date);
    const isToday = key === todayStr;
    const isSelected = key === selectedStr;
    const dayEvents = eventsByDate.get(key) || [];

    const categoryDots = [
      ...new Set(dayEvents.flatMap((e) => e.tags?.slice(0, 1) || [])),
    ].slice(0, 4);

    return (
      <button
        key={key}
        onClick={() => handleDayClick(date)}
        className={cn(
          "bg-background p-2 text-right text-sm font-medium relative transition-colors cursor-pointer flex flex-col",
          tall ? "min-h-[180px]" : "min-h-[100px]",
          !isCurrentPeriod && "text-muted-foreground/40",
          isCurrentPeriod && "text-foreground hover:bg-secondary/50",
          isSelected &&
            "bg-primary/5 dark:bg-primary/5 ring-1 ring-inset ring-primary shadow-[0_0_15px_hsl(var(--primary)/0.12)] z-10",
          isToday && !isSelected && "bg-secondary/60"
        )}
      >
        <div className="flex items-center justify-end gap-1.5">
          {dayEvents.length > 0 && (
            <div className="flex gap-0.5">
              {categoryDots.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    "size-1.5 rounded-full",
                    DOT_COLORS[tag] || "bg-primary"
                  )}
                />
              ))}
            </div>
          )}

          {dayEvents.length > 0 && (
            <span className="text-[9px] font-bold text-muted-foreground bg-secondary rounded-full size-4 inline-flex items-center justify-center">
              {dayEvents.length}
            </span>
          )}

          <span
            className={cn(
              isToday &&
                "bg-primary text-primary-foreground rounded-full size-6 inline-flex items-center justify-center text-xs font-bold"
            )}
          >
            {date.getDate()}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 mt-auto w-full">
          {dayEvents.slice(0, tall ? 5 : 3).map((event) => {
            const strip = getStripColors(event.tags);
            return (
              <div
                key={event.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEventClick(event);
                }}
                className={cn(
                  "border text-[10px] px-1.5 py-0.5 rounded truncate text-left font-medium hover:opacity-80 cursor-pointer",
                  strip.bg,
                  strip.border,
                  strip.text
                )}
              >
                {event.title}
              </div>
            );
          })}
          {dayEvents.length > (tall ? 5 : 3) && (
            <span className="text-[10px] text-primary font-bold text-left px-1">
              +{dayEvents.length - (tall ? 5 : 3)} more
            </span>
          )}
        </div>
      </button>
    );
  };

  /* ── Main render ── */

  return (
    <ErrorBoundary fallbackMessage="We couldn't load the calendar right now.">
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
        {/* ═══ Left Pane ═══ */}
        <div className="flex flex-1 flex-col overflow-y-auto lg:border-r border-border">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-6 lg:p-8 pb-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-foreground text-3xl font-bold tracking-tight">
                Event Calendar
              </h1>
              <p className="text-muted-foreground text-sm font-medium">
                Your saved and RSVP&apos;d McGill events.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 items-center rounded-lg bg-secondary p-1 border border-border">
                {(["Saved", "Month", "Week"] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => switchView(view)}
                    className={cn(
                      "flex h-full cursor-pointer items-center justify-center rounded-md px-4 text-sm font-medium transition-colors",
                      calendarView === view
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {view}
                  </button>
                ))}
              </div>
              <button
                onClick={() => downloadIcal(events)}
                disabled={events.length === 0}
                className="flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-secondary hover:bg-secondary/80 border border-border text-foreground text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export .ics</span>
              </button>
            </div>
          </div>

          {/* List view toolbar: sort + CSV export */}
          {calendarView === "Saved" && !loading && events.length > 0 && (
            <div className="flex items-center justify-end gap-2 px-6 lg:px-8 mb-4">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleExportCsv}
                disabled={isExportingCsv}
              >
                {isExportingCsv ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                {isExportingCsv ? "Exporting..." : "Export CSV"}
              </Button>

              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="gap-2"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {SORT_LABELS[listSort]}
                </Button>
                {showSortMenu && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md bg-card border shadow-lg z-20">
                    {(Object.keys(SORT_LABELS) as SortOption[]).map(
                      (option) => (
                        <button
                          key={option}
                          onClick={() => {
                            setListSort(option);
                            setShowSortMenu(false);
                          }}
                          className={cn(
                            "block w-full text-left px-4 py-2 text-sm hover:bg-secondary/50 transition-colors cursor-pointer",
                            listSort === option
                              ? "font-semibold text-primary"
                              : "text-foreground"
                          )}
                        >
                          {SORT_LABELS[option]}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation (Month & Week) */}
          {calendarView !== "Saved" && (
            <div className="flex items-center justify-between px-6 lg:px-8 mb-4">
              <h2 className="text-foreground text-2xl font-bold">
                {navLabel}
                {loading && (
                  <span className="ml-2 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary align-[-2px]" />
                )}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    calendarView === "Week"
                      ? navigateWeek("prev")
                      : navigateMonth("prev")
                  }
                  className="flex items-center justify-center size-8 rounded-md bg-secondary hover:bg-secondary/80 border border-border text-foreground transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={goToToday}
                  className="flex items-center justify-center px-3 h-8 rounded-md bg-secondary hover:bg-secondary/80 border border-border text-foreground text-sm font-medium transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() =>
                    calendarView === "Week"
                      ? navigateWeek("next")
                      : navigateMonth("next")
                  }
                  className="flex items-center justify-center size-8 rounded-md bg-secondary hover:bg-secondary/80 border border-border text-foreground transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Error state ── */}
          {error && !loading && (
            <div className="mx-6 lg:mx-8 mb-4 flex flex-col items-center justify-center py-12 text-center space-y-4 bg-card/50 rounded-xl border border-destructive/30 backdrop-blur-sm p-8">
              <div className="rounded-full bg-primary/10 p-4">
                <AlertCircle className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-foreground">
                  Something went wrong
                </h3>
                <p className="text-muted-foreground">{error}</p>
              </div>
              <Button
                onClick={() => fetchEvents()}
                variant="outline"
                className="gap-2"
              >
                <RefreshCcw className="h-4 w-4" />
                Try Again
              </Button>
            </div>
          )}

          {/* ── View content with transition ── */}
          <div
            className={cn(
              "transition-opacity duration-150",
              transitioning ? "opacity-0" : "opacity-100"
            )}
          >
            {/* ── Month View ── */}
            {calendarView === "Month" && !error && (
              <div
                ref={gridRef}
                tabIndex={0}
                onKeyDown={handleGridKeyDown}
                className="px-6 lg:px-8 pb-8 flex-1 min-h-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-xl"
              >
                <div className="grid grid-cols-7 gap-[1px] bg-border rounded-xl overflow-hidden border border-border">
                  {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(
                    (day) => (
                      <div
                        key={day}
                        className="bg-secondary p-3 text-right text-muted-foreground text-xs font-semibold tracking-wider uppercase"
                      >
                        {day}
                      </div>
                    )
                  )}

                  {loading && events.length === 0
                    ? Array.from({ length: monthGrid.length }).map((_, i) => (
                        <div
                          key={`skel-${i}`}
                          className="bg-background min-h-[100px] p-2"
                        >
                          <Skeleton className="h-5 w-5 rounded-full mb-2 ml-auto" />
                          <Skeleton className="h-4 w-3/4 rounded ml-auto" />
                        </div>
                      ))
                    : monthGrid.map(({ date, isCurrentMonth }) =>
                        renderDayCell(date, isCurrentMonth, false)
                      )}
                </div>
              </div>
            )}

            {/* ── Week View ── */}
            {calendarView === "Week" && !error && (
              <div
                ref={gridRef}
                tabIndex={0}
                onKeyDown={handleGridKeyDown}
                className="px-6 lg:px-8 pb-8 flex-1 min-h-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-xl"
              >
                <div className="grid grid-cols-7 gap-[1px] bg-border rounded-xl overflow-hidden border border-border">
                  {weekDays.map((d) => {
                    const isToday = dateKey(d) === todayStr;
                    return (
                      <div
                        key={dateKey(d)}
                        className={cn(
                          "bg-secondary p-3 text-center text-xs font-semibold tracking-wider uppercase",
                          isToday
                            ? "text-primary"
                            : "text-muted-foreground"
                        )}
                      >
                        {d.toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                    );
                  })}

                  {loading && events.length === 0
                    ? weekDays.map((_, i) => (
                        <div
                          key={`wskel-${i}`}
                          className="bg-background min-h-[180px] p-2"
                        >
                          <Skeleton className="h-5 w-5 rounded-full mb-2 ml-auto" />
                          <Skeleton className="h-4 w-full rounded mb-1" />
                          <Skeleton className="h-4 w-3/4 rounded" />
                        </div>
                      ))
                    : weekDays.map((d) => renderDayCell(d, true, true))}
                </div>
              </div>
            )}

            {/* ── List View ── */}
            {calendarView === "Saved" && !error && (
              <div className="px-6 lg:px-8 pb-8 flex-1 min-h-0 overflow-y-auto">
                {loading ? (
                  <div className="flex flex-col gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton
                        key={i}
                        className="h-28 w-full rounded-2xl"
                      />
                    ))}
                  </div>
                ) : listEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <CalendarOff className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-foreground font-semibold text-lg">
                      No saved events yet
                    </p>
                    <p className="text-muted-foreground text-sm mt-1">
                      Save or RSVP to events and they&apos;ll appear here.
                    </p>
                    <a
                      href="/"
                      className="mt-4 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-semibold rounded-lg transition-colors"
                    >
                      Discover Events
                    </a>
                  </div>
                ) : groupedList ? (
                  /* Date-grouped view */
                  <div className="flex flex-col gap-6">
                    {groupedList.map((group) => (
                      <div key={group.date}>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1 flex items-center gap-2">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {formatDateHeading(group.date)}
                          {group.date === todayStr && (
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold normal-case tracking-normal">
                              Today
                            </span>
                          )}
                        </h3>
                        <div className="flex flex-col gap-3">
                          {group.events.map(renderAgendaCard)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Flat list (title or recent sort) */
                  <div className="flex flex-col gap-3">
                    {listEvents.map(renderAgendaCard)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile scroll hint for agenda */}
          {calendarView !== "Saved" && !error && !loading && (
            <div className="lg:hidden flex justify-center py-3 border-t border-border bg-background/80">
              <button
                onClick={() =>
                  agendaRef.current?.scrollIntoView({ behavior: "smooth" })
                }
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronsDown className="h-3.5 w-3.5" />
                Scroll for daily agenda
              </button>
            </div>
          )}
        </div>

        {/* ═══ Right Pane — Daily Agenda ═══ */}
        {calendarView !== "Saved" && (
          <div
            ref={agendaRef}
            className="w-full lg:w-[380px] xl:w-[400px] flex flex-col bg-card lg:bg-secondary/30 overflow-hidden border-t lg:border-t-0 border-border"
          >
            <div className="p-6 border-b border-border sticky top-0 z-10 bg-card lg:bg-secondary/30 backdrop-blur-sm">
              <h3 className="text-foreground text-xl font-bold tracking-tight mb-1">
                Daily Agenda
              </h3>
              <p className="text-primary font-medium text-sm">
                {selectedDateLabel}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              {loading ? (
                <>
                  <Skeleton className="h-36 w-full rounded-2xl" />
                  <Skeleton className="h-36 w-full rounded-2xl" />
                </>
              ) : selectedDayEvents.length > 0 ? (
                selectedDayEvents.map(renderAgendaCard)
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-border rounded-2xl bg-background/50">
                  <CalendarOff className="h-8 w-8 text-muted-foreground/40 mb-3" />
                  <p className="text-foreground text-sm font-medium">
                    No events on this day
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Save or RSVP to events to see them here.
                  </p>
                  <a
                    href="/"
                    className="mt-4 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-semibold rounded-lg transition-colors"
                  >
                    Discover Events
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <EventDetailsModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setSelectedEvent(null);
        }}
        event={selectedEvent}
        trackingSource="calendar"
      />
    </ErrorBoundary>
  );
}

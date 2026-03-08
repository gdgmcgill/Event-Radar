// src/components/events/HomeFeed.tsx
"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { EVENT_CATEGORIES, EVENT_TAGS } from "@/lib/constants";
import type { Event, EventTag } from "@/types";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  Calendar,
  Clock,
  Flame,
  Star,
  ArrowRight,
  Bookmark,
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Props ────────────────────────────────────────────────────────────────────

interface HomeFeedProps {
  events: Event[];
  featuredEvents?: Event[];
  onEventClick?: (eventId: string) => void;
  onSaveEvent?: (eventId: string) => void;
  savedEventIds?: string[];
}

// ── Icon map for category rows ───────────────────────────────────────────────

const TAG_ICON_MAP: Record<string, LucideIcon> = {
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
  Heart,
};

// ── Scroll Row (reusable horizontal scroll container) ────────────────────────

interface ScrollRowProps {
  children: React.ReactNode;
  className?: string;
}

function ScrollRow({ children, className }: ScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      observer.disconnect();
    };
  }, [checkScroll]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "left" ? -el.clientWidth * 0.75 : el.clientWidth * 0.75,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative group/scroll">
      {canScrollLeft && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <Button
            variant="secondary"
            size="icon"
            onClick={() => scroll("left")}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full shadow-lg bg-card/90 backdrop-blur-sm border border-border/50 opacity-0 group-hover/scroll:opacity-100 transition-opacity"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </>
      )}

      <div
        ref={scrollRef}
        className={cn(
          "flex gap-6 overflow-x-auto pb-4 scroll-smooth",
          className,
        )}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>

      {canScrollRight && (
        <>
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          <Button
            variant="secondary"
            size="icon"
            onClick={() => scroll("right")}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full shadow-lg bg-card/90 backdrop-blur-sm border border-border/50 opacity-0 group-hover/scroll:opacity-100 transition-opacity"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </>
      )}
    </div>
  );
}

// ── Hero Banner ──────────────────────────────────────────────────────────────

interface HeroBannerProps {
  event: Event;
  onEventClick?: (eventId: string) => void;
  onSaveEvent?: (eventId: string) => void;
  isSaved?: boolean;
}

function HeroBanner({ event, onEventClick, onSaveEvent, isSaved }: HeroBannerProps) {
  return (
    <section
      className="relative w-full aspect-[21/9] min-h-[320px] md:min-h-[400px] overflow-hidden cursor-pointer"
      onClick={() => onEventClick?.(event.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onEventClick?.(event.id);
      }}
      aria-label={`Featured event: ${event.title}`}
    >
      {/* Background image */}
      <div className="absolute inset-0 transition-transform duration-700 hover:scale-105">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#561c24] to-[#ED1B2F]" />
        )}
      </div>

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0) 100%)",
        }}
      />

      {/* Content */}
      <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 lg:p-16 flex flex-col items-start gap-3">
        <div className="flex items-center gap-2 px-3 py-1 bg-[#ED1B2F] text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
          <Star className="h-3 w-3" />
          Major Event
        </div>

        <h2 className="text-3xl md:text-5xl lg:text-7xl font-black text-white leading-tight tracking-tighter uppercase">
          {event.title}
        </h2>

        <p className="text-slate-200 text-sm md:text-lg max-w-2xl leading-relaxed font-medium line-clamp-3">
          {event.description}
        </p>

        <div className="flex items-center gap-4 mt-2 md:mt-4">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onEventClick?.(event.id);
            }}
            className="px-6 md:px-8 py-3 bg-[#ED1B2F] text-white rounded-xl font-bold hover:bg-[#ED1B2F]/90 transition-all shadow-xl shadow-[#ED1B2F]/20"
          >
            <Calendar className="h-4 w-4 mr-2" />
            RSVP Now
          </Button>
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onSaveEvent?.(event.id);
            }}
            className={cn(
              "px-6 md:px-8 py-3 rounded-xl font-bold transition-all border",
              isSaved
                ? "bg-white/20 text-white border-white/50"
                : "bg-white/10 text-white border-white/30 hover:bg-white/20"
            )}
          >
            <Bookmark className={cn("h-4 w-4 mr-2", isSaved && "fill-current")} />
            {isSaved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>
    </section>
  );
}

// ── Sponsored / Featured Card ────────────────────────────────────────────────

interface SponsoredCardProps {
  event: Event;
  onEventClick?: (eventId: string) => void;
}

function SponsoredCard({ event, onEventClick }: SponsoredCardProps) {
  return (
    <div
      className="flex-shrink-0 w-80 md:w-96 group cursor-pointer"
      onClick={() => onEventClick?.(event.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onEventClick?.(event.id);
      }}
    >
      <div className="relative aspect-video rounded-2xl overflow-hidden mb-3 ring-1 ring-border dark:ring-[#ED1B2F]/20 group-hover:ring-[#ED1B2F]/50 transition-all shadow-xl">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#561c24] to-[#ED1B2F]/60" />
        )}

        {/* SPONSORED badge */}
        <div className="absolute top-3 left-3 px-2 py-1 bg-white/90 backdrop-blur-md text-slate-900 text-[10px] font-black rounded border border-slate-200">
          FEATURED
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="px-6 py-2 bg-white text-black font-bold rounded-full transform translate-y-4 group-hover:translate-y-0 transition-transform text-sm">
            View Event
          </span>
        </div>
      </div>

      <h4 className="font-bold text-lg md:text-xl mb-1 group-hover:text-[#ED1B2F] transition-colors line-clamp-1">
        {event.title}
      </h4>
      <p className="text-muted-foreground text-sm font-medium line-clamp-1">
        {event.club?.name || event.location} &middot; {formatDate(event.event_date)}
      </p>
    </div>
  );
}

// ── Trending Event Card ──────────────────────────────────────────────────────

interface TrendingCardProps {
  event: Event;
  onEventClick?: (eventId: string) => void;
  onSaveEvent?: (eventId: string) => void;
  isSaved?: boolean;
}

function TrendingCard({ event, onEventClick, onSaveEvent, isSaved }: TrendingCardProps) {
  const primaryTag = event.tags[0];
  const tagLabel = primaryTag ? EVENT_CATEGORIES[primaryTag]?.label : null;

  return (
    <div
      className="flex-shrink-0 w-72 md:w-80 group cursor-pointer"
      onClick={() => onEventClick?.(event.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onEventClick?.(event.id);
      }}
    >
      <div className="relative aspect-video rounded-xl overflow-hidden mb-3">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900" />
        )}

        {/* Category badge */}
        {tagLabel && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded uppercase">
            {tagLabel}
          </div>
        )}

        {/* Date badge */}
        <div className="absolute bottom-3 right-3 px-3 py-1 bg-[#ED1B2F] text-white text-xs font-bold rounded-full">
          {formatDate(event.event_date).split(",")[0]?.split(" ").slice(0, 2).join(" ") || formatDate(event.event_date)}
        </div>

        {/* Save button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSaveEvent?.(event.id);
          }}
          className={cn(
            "absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center backdrop-blur-md border transition-all z-20",
            isSaved
              ? "bg-[#ED1B2F] border-[#ED1B2F] text-white"
              : "bg-white/20 border-white/30 text-white hover:bg-white/40"
          )}
          aria-label={isSaved ? "Unsave event" : "Save event"}
        >
          <Heart className={cn("h-3.5 w-3.5", isSaved && "fill-current")} />
        </button>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <span className="px-4 py-2 bg-[#ED1B2F] text-white text-xs font-bold rounded-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            View Details
          </span>
        </div>
      </div>

      <h4 className="font-bold text-lg mb-1 group-hover:text-[#ED1B2F] transition-colors line-clamp-1">
        {event.title}
      </h4>
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <MapPin className="h-3.5 w-3.5" />
        <span className="line-clamp-1">{event.location}</span>
      </div>
    </div>
  );
}

// ── Compact Card (for Academic / category rows) ──────────────────────────────

interface CompactCardProps {
  event: Event;
  onEventClick?: (eventId: string) => void;
}

function CompactCard({ event, onEventClick }: CompactCardProps) {
  const primaryTag = event.tags[0];
  const category = primaryTag ? EVENT_CATEGORIES[primaryTag] : null;
  const Icon = category ? TAG_ICON_MAP[category.icon] || Heart : Heart;

  return (
    <div
      className="flex-shrink-0 w-60 md:w-64 bg-muted/50 dark:bg-[#ED1B2F]/5 p-4 rounded-xl border border-transparent hover:border-[#ED1B2F]/20 transition-all cursor-pointer"
      onClick={() => onEventClick?.(event.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onEventClick?.(event.id);
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-card dark:bg-background rounded-lg flex items-center justify-center text-[#ED1B2F] shadow-sm flex-shrink-0">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h4 className="font-bold text-sm leading-tight line-clamp-2">{event.title}</h4>
          <p className="text-xs text-muted-foreground line-clamp-1">{event.location}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
        {event.description}
      </p>
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold text-[#ED1B2F] uppercase">
          {formatDate(event.event_date).split(",")[0]} &middot; {formatTime(event.event_time)}
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

// ── Personalized Card ────────────────────────────────────────────────────────

interface PersonalizedCardProps {
  event: Event;
  onEventClick?: (eventId: string) => void;
  onSaveEvent?: (eventId: string) => void;
  isSaved?: boolean;
}

function PersonalizedCard({ event, onEventClick, onSaveEvent, isSaved }: PersonalizedCardProps) {
  const primaryTag = event.tags[0];
  const category = primaryTag ? EVENT_CATEGORIES[primaryTag] : null;
  const Icon = category ? TAG_ICON_MAP[category.icon] || Heart : Heart;

  return (
    <div
      className="flex-shrink-0 w-68 md:w-72 bg-card dark:bg-background p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onEventClick?.(event.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onEventClick?.(event.id);
      }}
    >
      <div className="text-[#ED1B2F] mb-4">
        <Icon className="h-10 w-10" />
      </div>
      <h4 className="font-bold text-xl mb-2 line-clamp-2">{event.title}</h4>
      <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
        {event.description}
      </p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
        <Clock className="h-3.5 w-3.5" />
        <span>{formatDate(event.event_date)} at {formatTime(event.event_time)}</span>
      </div>
      <Button
        variant="secondary"
        className="w-full font-bold text-sm"
        onClick={(e) => {
          e.stopPropagation();
          onSaveEvent?.(event.id);
        }}
      >
        <Bookmark className={cn("h-4 w-4 mr-2", isSaved && "fill-current")} />
        {isSaved ? "Saved" : "Save to Calendar"}
      </Button>
    </div>
  );
}

// ── Section Header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  onViewAll?: () => void;
}

function SectionHeader({ title, icon, onViewAll }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h3 className="font-black tracking-tight flex items-center gap-2 text-2xl md:text-3xl">
        {title}
        {icon}
      </h3>
      {onViewAll && (
        <button
          onClick={onViewAll}
          className="text-[#ED1B2F] text-sm font-bold hover:underline flex items-center gap-1"
        >
          View All
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Main HomeFeed Component ──────────────────────────────────────────────────

export function HomeFeed({
  events,
  featuredEvents,
  onEventClick,
  onSaveEvent,
  savedEventIds = [],
}: HomeFeedProps) {
  const savedSet = useMemo(() => new Set(savedEventIds), [savedEventIds]);

  // Pick hero event: first featured or first event overall
  const heroEvent = featuredEvents?.[0] ?? events[0];

  // Featured / sponsored row: remaining featured events
  const sponsoredRow = useMemo(() => {
    if (featuredEvents && featuredEvents.length > 1) {
      return featuredEvents.slice(1);
    }
    // Fallback: pick a few events with images
    return events.filter((e) => e.image_url).slice(0, 4);
  }, [featuredEvents, events]);

  // Trending: sort by most recently created (proxy for trending), take first 8
  const trendingEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);
  }, [events]);

  // Group events by tag for category rows
  const eventsByTag = useMemo(() => {
    const map = new Map<EventTag, Event[]>();
    for (const tag of EVENT_TAGS) {
      map.set(tag, []);
    }
    for (const event of events) {
      for (const tag of event.tags) {
        const list = map.get(tag);
        if (list) list.push(event);
      }
    }
    return map;
  }, [events]);

  // Personalized row: events with less common tags (simple heuristic)
  const personalizedEvents = useMemo(() => {
    // Pick events that have career, wellness, or cultural tags (often under-represented)
    const preferred = events.filter((e) =>
      e.tags.some((t) => t === "career" || t === "wellness" || t === "cultural")
    );
    if (preferred.length >= 3) return preferred.slice(0, 6);
    // Fallback
    return events.slice(Math.max(0, events.length - 6));
  }, [events]);

  if (!events.length && !featuredEvents?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No events to display</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* ── Hero Section ──────────────────────────────────────────── */}
      {heroEvent && (
        <HeroBanner
          event={heroEvent}
          onEventClick={onEventClick}
          onSaveEvent={onSaveEvent}
          isSaved={savedSet.has(heroEvent.id)}
        />
      )}

      {/* ── Sponsored / Featured Row ─────────────────────────────── */}
      {sponsoredRow.length > 0 && (
        <section className="mt-10 md:mt-12 px-4 md:px-8 lg:px-16">
          <SectionHeader
            title="Campus Partners & Featured"
            icon={<Star className="h-6 w-6 text-yellow-500" />}
          />
          <ScrollRow>
            {sponsoredRow.map((event) => (
              <SponsoredCard
                key={event.id}
                event={event}
                onEventClick={onEventClick}
              />
            ))}
          </ScrollRow>
        </section>
      )}

      {/* ── Carousel Sections ─────────────────────────────────────── */}
      <div className="flex flex-col px-4 md:px-8 lg:px-16 pb-20 mt-6 md:mt-10 gap-14 md:gap-20">
        {/* Trending Now */}
        {trendingEvents.length > 0 && (
          <section>
            <SectionHeader
              title="Trending Now"
              icon={<Flame className="h-6 w-6 text-[#ED1B2F]" />}
            />
            <ScrollRow>
              {trendingEvents.map((event) => (
                <TrendingCard
                  key={event.id}
                  event={event}
                  onEventClick={onEventClick}
                  onSaveEvent={onSaveEvent}
                  isSaved={savedSet.has(event.id)}
                />
              ))}
            </ScrollRow>
          </section>
        )}

        {/* Category Rows */}
        {EVENT_TAGS.map((tag) => {
          const categoryEvents = eventsByTag.get(tag) ?? [];
          if (categoryEvents.length === 0) return null;
          const category = EVENT_CATEGORIES[tag];

          return (
            <section key={tag}>
              <SectionHeader title={category.label} />
              <ScrollRow>
                {categoryEvents.map((event) => (
                  <CompactCard
                    key={event.id}
                    event={event}
                    onEventClick={onEventClick}
                  />
                ))}
              </ScrollRow>
            </section>
          );
        })}

        {/* Personalized For You */}
        {personalizedEvents.length > 0 && (
          <section className="bg-[#ED1B2F]/5 dark:bg-[#ED1B2F]/5 p-6 md:p-8 rounded-[2rem] border border-[#ED1B2F]/10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6 mb-8">
              <div>
                <h3 className="text-2xl md:text-3xl font-black tracking-tight mb-2">
                  Personalized for You
                </h3>
                <p className="text-muted-foreground max-w-lg text-sm md:text-base">
                  Events matched to your interests and activity on campus.
                </p>
              </div>
            </div>
            <ScrollRow>
              {personalizedEvents.map((event) => (
                <PersonalizedCard
                  key={event.id}
                  event={event}
                  onEventClick={onEventClick}
                  onSaveEvent={onSaveEvent}
                  isSaved={savedSet.has(event.id)}
                />
              ))}
            </ScrollRow>
          </section>
        )}
      </div>
    </div>
  );
}

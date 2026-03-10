"use client";

import { useRouter } from "next/navigation";
import { EventSearch } from "@/components/events/EventSearch";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { EventTag } from "@/types";
import {
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
  Heart,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TAG_ICONS: Record<string, LucideIcon> = {
  GraduationCap,
  Users,
  Trophy,
  Briefcase,
  Palette,
  Heart,
};

const QUICK_TAGS: EventTag[] = [
  EventTag.ACADEMIC,
  EventTag.SOCIAL,
  EventTag.SPORTS,
  EventTag.CAREER,
  EventTag.CULTURAL,
  EventTag.WELLNESS,
];

export function HeroSection() {
  const router = useRouter();

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/8 via-primary/4 to-background pb-16 pt-10 md:pt-16 md:pb-20">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="container mx-auto px-4 md:px-6 lg:px-8 relative">
        {/* Headline */}
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 md:mb-5">
            <Sparkles className="h-3.5 w-3.5" />
            McGill Campus Events
          </div>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.1] mb-4">
            Discover what&apos;s happening on campus
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            Find events, workshops, and socials from clubs across McGill. Never miss out.
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex justify-center mb-8 md:mb-10">
          <EventSearch
            onSearchChange={() => {}}
            placeholder="Search events, clubs, or topics..."
            variant="hero"
            className="max-w-xl"
          />
        </div>

        {/* Quick Category Pills */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-3">
          {QUICK_TAGS.map((tag) => {
            const category = EVENT_CATEGORIES[tag];
            const Icon = TAG_ICONS[category.icon] || Heart;

            return (
              <button
                key={tag}
                onClick={() => router.push(`/?category=${tag}`)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/60 bg-card/80 backdrop-blur-sm text-sm font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
              >
                <Icon className="h-4 w-4" />
                {category.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
